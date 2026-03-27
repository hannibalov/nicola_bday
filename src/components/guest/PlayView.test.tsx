/**
 * @jest-environment jsdom
 */
import { render, waitFor } from "@testing-library/react";
import PlayView from "./PlayView";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
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
beforeEach(() => {
  mockReplace.mockClear();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  global.EventSource = jest.fn(() => ({
    close: jest.fn(),
    onmessage: null as null | ((ev: MessageEvent) => void),
    onerror: null as null | ((ev: Event) => void),
  })) as unknown as typeof EventSource;
});

describe("PlayView", () => {
  it("redirects to check-in when server reports stale player id (post-reset)", async () => {
    fetchMock.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/session/clear-player-cookie")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response);
      }
      if (u.includes("/api/state")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              playerKnownToSession: false,
              guestStep: "party_protocol",
              revision: 0,
              currentGameIndex: 0,
              countdownRemaining: null,
              scheduledGameStartsAtEpochMs: null,
              currentGame: null,
              myTeam: null,
              myTeammateNicknames: [],
              lobbyTeams: [],
              playerCount: 0,
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
            }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });

    render(<PlayView />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/state", { credentials: "include" });
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
});
