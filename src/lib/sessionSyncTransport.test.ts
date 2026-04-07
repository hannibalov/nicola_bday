import {
  shouldAdminPanelUseWebSocket,
  shouldGuestPlayViewUseWebSocket,
  parseWebSocketPayload,
} from "./sessionSyncTransport";

const origDisable = process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE;

afterEach(() => {
  if (origDisable === undefined) {
    delete process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE;
  } else {
    process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE = origDisable;
  }
});

describe("sessionSyncTransport", () => {
  it("guest uses WebSocket by default", () => {
    delete process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE;
    expect(shouldGuestPlayViewUseWebSocket()).toBe(true);
  });

  it("guest skips WebSocket when NEXT_PUBLIC_NICOLA_DISABLE_SSE=1", () => {
    process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE = "1";
    expect(shouldGuestPlayViewUseWebSocket()).toBe(false);
  });

  it("admin always uses WebSocket as primary transport (guest disable env ignored)", () => {
    delete process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE;
    expect(shouldAdminPanelUseWebSocket()).toBe(true);
    process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE = "1";
    expect(shouldAdminPanelUseWebSocket()).toBe(true);
  });
});

describe("parseWebSocketPayload", () => {
  it("parses a valid WebSocket payload", () => {
    const raw = JSON.stringify({
      revision: 3,
      guestStep: "lobby_trivia",
      playerCount: 5,
    });
    expect(parseWebSocketPayload(raw)).toEqual({
      revision: 3,
      guestStep: "lobby_trivia",
      playerCount: 5,
    });
  });

  it("returns null for invalid JSON", () => {
    expect(parseWebSocketPayload("not-json")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(parseWebSocketPayload(JSON.stringify({ revision: 1 }))).toBeNull();
  });

  it("returns null when revision is not a number", () => {
    const raw = JSON.stringify({
      revision: "3",
      guestStep: "party_protocol",
      playerCount: 0,
    });
    expect(parseWebSocketPayload(raw)).toBeNull();
  });

  it("returns null when playerCount is missing", () => {
    const raw = JSON.stringify({ revision: 1, guestStep: "party_protocol" });
    expect(parseWebSocketPayload(raw)).toBeNull();
  });

  it("parses a payload that includes a full public state", () => {
    const raw = JSON.stringify({
      revision: 2,
      guestStep: "party_protocol",
      playerCount: 3,
      fullState: {
        guestStep: "party_protocol",
        revision: 2,
        currentGameIndex: 0,
        scheduledGameStartsAtEpochMs: null,
        currentGame: null,
        myTeam: null,
        myTeammateNicknames: [],
        lobbyTeams: [],
        playerCount: 3,
        players: [],
        teams: [],
        playerKnownToSession: true,
        leaderboard: [],
        finalLeaderboard: [],
        games: [],
        gameScores: {},
        syncRevision: 2,
        myBingoClaimedLineKeys: [],
        myBingoScore: 0,
        bingoRoundEndsAtEpochMs: null,
        myBingoMarkedCells: [],
        myTriviaVotes: {},
        myQuoteVotes: {},
        teamMcqSync: null,
      },
    });
    expect(parseWebSocketPayload(raw)).toEqual({
      revision: 2,
      guestStep: "party_protocol",
      playerCount: 3,
      fullState: expect.any(Object),
    });
  });
});
