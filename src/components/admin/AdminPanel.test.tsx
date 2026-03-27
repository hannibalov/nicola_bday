import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AdminPanel from "./AdminPanel";
import { guestStepLabel } from "@/lib/guestStepLabels";

const searchParamsMock = { keyFromUrl: "admin-secret" as string | null };

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (name: string) => (name === "key" ? searchParamsMock.keyFromUrl : null),
  }),
}));

const mockSessionState = (players: { id: string; nickname: string }[]) => ({
  guestStep: "party_protocol" as const,
  revision: 0,
  countdownRemaining: null,
  scheduledGameStartsAtEpochMs: null as number | null,
  players,
  teams: [],
  gameScores: {},
  bingoClaimedLineKeysByPlayer: {} as Record<string, string[]>,
  bingoSongOrder: [] as string[],
  bingoCurrentSongIndex: 0,
  bingoRoundEndsAtEpochMs: null as number | null,
  bingoMarkedByPlayer: {} as Record<string, boolean[]>,
  games: [
    { id: "g1", name: "Team trivia", type: "team" as const, countdownSeconds: 10 },
    { id: "g2", name: "Music bingo", type: "individual" as const, countdownSeconds: 10 },
    { id: "g3", name: "Who said it", type: "team" as const, countdownSeconds: 10 },
  ],
});

const mockFetch = jest.fn();

beforeEach(() => {
  searchParamsMock.keyFromUrl = "admin-secret";
  mockFetch.mockClear();
  (globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;
  global.EventSource = jest.fn(() => ({
    close: jest.fn(),
    onmessage: null as null | ((ev: MessageEvent) => void),
    onerror: null as null | ((ev: Event) => void),
  })) as unknown as typeof EventSource;
});

describe("AdminPanel", () => {
  it("shows prominent player count and uses no-store + x-admin-key on state fetch", async () => {
    mockFetch.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/admin/state")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve(
              mockSessionState([
                { id: "1", nickname: "Alice" },
                { id: "2", nickname: "Bob" },
              ])
            ),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${u}`));
    });

    render(<AdminPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("admin-player-count")).toHaveTextContent("2");
    });
    expect(screen.getByText(/players connected/i)).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/state",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          "x-admin-key": "admin-secret",
        }),
      })
    );
  });

  it("renders human-readable guest step label instead of the raw enum", async () => {
    mockFetch.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/admin/state")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ...mockSessionState([]),
              guestStep: "lobby_trivia" as const,
              revision: 2,
            }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${u}`));
    });

    render(<AdminPanel />);

    await waitFor(() => {
      expect(screen.getByText(guestStepLabel("lobby_trivia"))).toBeInTheDocument();
    });
    expect(screen.queryByText("lobby_trivia")).not.toBeInTheDocument();
  });

  it("does not fetch admin state until Continue when the key is not prefilled from the URL", async () => {
    searchParamsMock.keyFromUrl = null;
    mockFetch.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/admin/state")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve(
              mockSessionState([{ id: "1", nickname: "Alice" }])
            ),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${u}`));
    });

    render(<AdminPanel />);

    expect(mockFetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("admin-key-input"), {
      target: { value: "admin-secret" },
    });
    fireEvent.click(screen.getByTestId("admin-continue"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/state",
        expect.objectContaining({
          headers: expect.objectContaining({ "x-admin-key": "admin-secret" }),
        })
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("admin-player-count")).toHaveTextContent("1");
    });
  });

  it("advance triggers POST /api/admin/start-next with x-admin-key", async () => {
    mockFetch.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/admin/state")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve(mockSessionState([{ id: "1", nickname: "Alice" }])),
        } as Response);
      }
      if (u.includes("/api/admin/start-next")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${u}`));
    });

    render(<AdminPanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Advance →/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Advance →/ }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/start-next",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "x-admin-key": "admin-secret",
          }),
        })
      );
    });
  });

  it("shows invalid key message when admin state returns 401", async () => {
    mockFetch.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/admin/state")) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "Unauthorized" }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${u}`));
    });

    render(<AdminPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Invalid admin key/i)).toBeInTheDocument();
    });

    expect(mockFetch).not.toHaveBeenCalledWith(
      "/api/admin/start-next",
      expect.anything()
    );
  });

  it("surfaces action error when advance returns non-OK", async () => {
    mockFetch.mockImplementation((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/admin/state")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve(mockSessionState([{ id: "1", nickname: "Alice" }])),
        } as Response);
      }
      if (u.includes("/api/admin/start-next")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Server oops" }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${u}`));
    });

    render(<AdminPanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Advance →/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Advance →/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server oops");
    });
  });
});
