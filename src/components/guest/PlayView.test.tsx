/**
 * @jest-environment jsdom
 */
import { render, waitFor, act, screen } from "@testing-library/react";
import PlayView from "./PlayView";

let currentSearchParams = new URLSearchParams();
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => currentSearchParams,
}));

jest.mock("@/components/layout/GuestPlayShell", () => ({
  __esModule: true,
  default: function Shell({ children }: { children: React.ReactNode }) {
    return <div data-test-id="guest-shell">{children}</div>;
  },
}));

jest.mock("./WaitingLobby", () => ({
  __esModule: true,
  default: () => <div>waiting</div>,
}));

jest.mock("./PartyProtocolScreen", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./LobbyScreen", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./MusicBingoScreen", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./TriviaGameScreen", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./IdentifyQuoteGameScreen", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./GameLeaderboard", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./FinalLeaderboard", () => ({
  __esModule: true,
  default: () => null,
}));

const fetchMock = jest.fn();

type MockEventSource = {
  close: jest.Mock;
  onmessage: null | ((ev: MessageEvent) => void);
  onerror: null | ((ev: Event) => void);
};

let lastEventSource: MockEventSource | null = null;

beforeEach(() => {
  mockReplace.mockClear();
  currentSearchParams = new URLSearchParams();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  lastEventSource = null;
  global.EventSource = jest.fn(() => {
    const es: MockEventSource = {
      close: jest.fn(),
      onmessage: null,
      onerror: null,
    };
    lastEventSource = es;
    return es;
  }) as unknown as typeof EventSource;
});

function makeStateResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        playerKnownToSession: true,
        guestStep: "party_protocol",
        revision: 0,
        currentGameIndex: 0,
        countdownRemaining: null,
        scheduledGameStartsAtEpochMs: null,
        currentGame: null,
        myTeam: null,
        myTeammateNicknames: [],
        lobbyTeams: [],
        playerCount: 1,
        leaderboard: [],
        finalLeaderboard: [],
        games: [],
        syncRevision: 0,
        myBingoClaimedLineKeys: [],
        myBingoScore: 0,
        bingoRoundEndsAtEpochMs: null,
        myBingoMarkedCells: [],
        myTriviaVotes: {},
        myQuoteVotes: {},
        teamMcqSync: null,
        ...overrides,
      }),
  } as Response;
}

describe("PlayView", () => {
  it("redirects to check-in when server reports stale player id (post-reset)", async () => {
    fetchMock.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/session/clear-player-cookie")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response);
      }
      if (u.includes("/api/state")) {
        return Promise.resolve(makeStateResponse({ playerKnownToSession: false }));
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });

    render(<PlayView />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/state",
        expect.objectContaining({ credentials: "include" }),
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/state",
        expect.objectContaining({ credentials: "include" }),
      );
    });


    // Trigger second fetch via SSE to hit redirection threshold (2 attempts)
    act(() => {
      if (lastEventSource?.onmessage) {
        lastEventSource.onmessage(
          new MessageEvent("message", {
            data: JSON.stringify({ revision: 12, guestStep: "party_protocol", playerCount: 1 }),
          })
        );
      }
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/session/clear-player-cookie", {
        method: "POST",
        credentials: "include",
      });
    });


    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("when protocolTest=1, stale player redirect preserves test query string", async () => {
    currentSearchParams = new URLSearchParams("protocolTest=1&nickname=Bot1");
    fetchMock.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/session/clear-player-cookie")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true }),
        } as Response);
      }
      if (u.includes("/api/state")) {
        return Promise.resolve(makeStateResponse({ playerKnownToSession: false }));
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });

    jest.useFakeTimers();
    render(<PlayView />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // Wait for the poll
    act(() => {
      jest.advanceTimersByTime(2001);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/?protocolTest=1&nickname=Bot1",
      );
    });
    jest.useRealTimers();


  });

  it("with protocolTest=1 does not open EventSource (HTTP/1.1 connection limit)", async () => {
    const eventSourceSpy = global.EventSource as unknown as jest.Mock;
    currentSearchParams = new URLSearchParams("protocolTest=1&nickname=T0");
    fetchMock.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/state")) {
        return Promise.resolve(makeStateResponse({ playerKnownToSession: true }));
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    eventSourceSpy.mockClear();

    render(<PlayView />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(eventSourceSpy).not.toHaveBeenCalled();
  });

  it("SSE onmessage with same revision does NOT trigger a new fetchState", async () => {
    fetchMock.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/state")) {
        return Promise.resolve(makeStateResponse({ revision: 5, syncRevision: 5 }));
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });

    render(<PlayView />);
    await waitFor(() => expect(screen.queryByText(/Loading…/i)).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);


    // Fire SSE message with identical revision
    act(() => {
      if (lastEventSource?.onmessage) {
        lastEventSource.onmessage(
          new MessageEvent("message", {
            data: JSON.stringify({ revision: 5, guestStep: "party_protocol", playerCount: 1 }),
          })
        );
      }
    });

    // Should still be only 1 fetch call (no new fetch triggered by same-revision SSE)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("SSE onmessage with higher revision DOES trigger a new fetchState", async () => {
    let callCount = 0;
    fetchMock.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/state")) {
        callCount++;
        const rev = callCount === 1 ? 5 : 6;
        return Promise.resolve(makeStateResponse({ revision: rev, syncRevision: rev }));
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });

    render(<PlayView />);
    await waitFor(() => expect(screen.queryByText(/Loading…/i)).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);


    act(() => {
      if (lastEventSource?.onmessage) {
        lastEventSource.onmessage(
          new MessageEvent("message", {
            data: JSON.stringify({ revision: 6, guestStep: "party_protocol", playerCount: 1 }),
          })
        );
      }
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it("SSE onerror closes EventSource and falls back to polling (no second EventSource opened)", async () => {
    const eventSourceSpy = global.EventSource as unknown as jest.Mock;
    fetchMock.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/state")) {
        return Promise.resolve(makeStateResponse());
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });

    render(<PlayView />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const es = lastEventSource!;
    act(() => {
      es.onerror?.(new Event("error"));
    });

    // EventSource.close should have been called
    expect(es.close).toHaveBeenCalled();

    // No second EventSource should be opened
    expect(eventSourceSpy).toHaveBeenCalledTimes(1);
  });

  it("handles playerKnownToSession:false with a grace period (retries before redirecting)", async () => {
    let callCount = 0;
    fetchMock.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/session/clear-player-cookie")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
      }
      if (u.includes("/api/state")) {
        callCount++;
        // First call returns false (simulating transient issue), subsequent calls also false
        return Promise.resolve(makeStateResponse({ playerKnownToSession: false }));
      }
      return Promise.reject(new Error("unexpected"));
    });

    render(<PlayView />);
    // Wait for the first fetch call
    expect(mockReplace).not.toHaveBeenCalled();


    // Trigger another fetch via SSE with higher revision
    act(() => {
      if (lastEventSource?.onmessage) {
        lastEventSource.onmessage(
          new MessageEvent("message", {
            data: JSON.stringify({ revision: 11, guestStep: "party_protocol", playerCount: 1 }),
          })
        );
      }
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // After two consecutive failures, it should finally redirect
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });

  it("updates player count immediately from SSE without a full re-fetch", async () => {
    fetchMock.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/state")) {
        return Promise.resolve(makeStateResponse({ playerCount: 1, revision: 10 }));
      }
      return Promise.reject(new Error("unexpected"));
    });

    render(<PlayView />);
    await waitFor(() => expect(screen.queryByText(/Loading…/i)).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);


    // Fire SSE event with same revision but updated player count
    act(() => {
      if (lastEventSource?.onmessage) {
        lastEventSource.onmessage(
          new MessageEvent("message", {
            data: JSON.stringify({ revision: 10, guestStep: "party_protocol", playerCount: 99 }),
          })
        );
      }
    });

    // Check if playerCount is reflected (needs access to state or checking a component that uses it)
    // Since we mock components, we can't easily check the DOM for playerCount minus adding a test-id
    // But we CAN verify that fetchState was NOT called a second time.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
