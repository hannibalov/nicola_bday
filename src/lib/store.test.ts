import {
  registerPlayer,
  getSessionState,
  getPublicState,
  advancePhase,
  resetSession,
  rebuildTeams,
  claimBingo,
  submitTriviaVote,
  submitQuoteVote,
  applyDueScheduledTransitions,
} from "./store";
import { TRIVIA_QUESTIONS } from "@/content/trivia";
import { getQuoteQuestions } from "./quoteContent";
import { GAMES } from "./gameConfig";
import { GUEST_STEP_SEQUENCE, type GuestStep } from "@/types";

beforeEach(() => {
  resetSession();
});

/**
 * One host “chapter” in tests: advance phase, and if the host just scheduled a lobby countdown
 * (same step + timestamp), jump to the game immediately.
 */
function stepForwardInTests(): void {
  const beforeStep = getSessionState().guestStep;
  advancePhase();
  const after = getSessionState();
  if (
    after.guestStep === beforeStep &&
    after.scheduledGameStartsAtEpochMs != null
  ) {
    applyDueScheduledTransitions(after.scheduledGameStartsAtEpochMs + 1);
  }
}

describe("store", () => {
  describe("registerPlayer", () => {
    it("adds a player with unique id and nickname", () => {
      const id = registerPlayer("Alice");
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(getSessionState().players).toHaveLength(1);
      expect(getSessionState().players[0]).toEqual({ id, nickname: "Alice" });
    });

    it("allows multiple players with different nicknames", () => {
      const id1 = registerPlayer("Alice");
      const id2 = registerPlayer("Bob");
      expect(id1).not.toBe(id2);
      expect(getSessionState().players).toHaveLength(2);
    });
  });

  describe("getSessionState", () => {
    it("returns initial party_protocol and empty players", () => {
      const state = getSessionState();
      expect(state.guestStep).toBe("party_protocol");
      expect(state.revision).toBe(0);
      expect(state.scheduledGameStartsAtEpochMs).toBeNull();
      expect(state.players).toEqual([]);
      expect(state.teams).toEqual([]);
      expect(state.games).toEqual(GAMES);
    });
  });

  describe("advancePhase", () => {
    it("first advance moves to lobby_trivia and bumps revision", () => {
      registerPlayer("Alice");
      advancePhase();
      const state = getSessionState();
      expect(state.guestStep).toBe("lobby_trivia");
      expect(state.revision).toBe(1);
    });

    it("second advance from lobby schedules game start without changing step", () => {
      registerPlayer("Alice");
      advancePhase();
      advancePhase();
      const state = getSessionState();
      expect(state.guestStep).toBe("lobby_trivia");
      expect(state.scheduledGameStartsAtEpochMs).not.toBeNull();
    });

    it("applyDueScheduledTransitions moves lobby into game_trivia and clears schedule", () => {
      registerPlayer("Alice");
      advancePhase();
      advancePhase();
      const startAt = getSessionState().scheduledGameStartsAtEpochMs!;
      expect(startAt).toBeGreaterThan(Date.now());
      applyDueScheduledTransitions(startAt + 1);
      expect(getSessionState().guestStep).toBe("game_trivia");
      expect(getSessionState().scheduledGameStartsAtEpochMs).toBeNull();
      expect(getSessionState().countdownRemaining).toBeNull();
    });

    it("from game_trivia moves to leaderboard and records scores", () => {
      registerPlayer("Alice");
      registerPlayer("Bob");
      stepForwardInTests();
      stepForwardInTests();
      advancePhase();
      const state = getSessionState();
      expect(state.guestStep).toBe("leaderboard_post_trivia");
      expect(state.gameScores[GAMES[0].id]).toBeDefined();
    });

    it("trivia leaderboard uses majority team scoring (+50 per correct question per player)", () => {
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) ids.push(registerPlayer(`P${i}`));
      while (getSessionState().guestStep !== "game_trivia") {
        stepForwardInTests();
      }
      const teams = getSessionState().teams;
      const teamA = teams[0]!;
      for (const q of TRIVIA_QUESTIONS) {
        for (const pid of teamA.playerIds) {
          expect(submitTriviaVote(pid, q.id, q.correctIndex).ok).toBe(true);
        }
      }
      advancePhase();
      const board = getSessionState().gameScores[GAMES[0].id]!;
      const expected = TRIVIA_QUESTIONS.length * 50;
      teamA.playerIds.forEach((pid) => {
        expect(board[pid]).toBe(expected);
      });
    });

    it("gives all teammates the same round score for team games", () => {
      for (let i = 0; i < 6; i++) registerPlayer(`P${i}`);
      while (getSessionState().guestStep !== "leaderboard_post_trivia") {
        stepForwardInTests();
      }
      const board = getSessionState().gameScores[GAMES[0].id]!;
      const teams = getSessionState().teams;
      teams.forEach((t) => {
        const pts = t.playerIds.map((id) => board[id]);
        const first = pts[0];
        expect(first).toBeDefined();
        pts.forEach((p) => expect(p).toBe(first));
      });
    });

    it("runs full sequence to leaderboard_final", () => {
      registerPlayer("Alice");
      for (let i = 0; i < GUEST_STEP_SEQUENCE.length - 1; i++) {
        stepForwardInTests();
      }
      expect(getSessionState().guestStep).toBe("leaderboard_final");
    });

    it("does not advance past leaderboard_final", () => {
      registerPlayer("Alice");
      for (let i = 0; i < GUEST_STEP_SEQUENCE.length - 1; i++) {
        stepForwardInTests();
      }
      const rev = getSessionState().revision;
      advancePhase();
      expect(getSessionState().guestStep).toBe("leaderboard_final");
      expect(getSessionState().revision).toBe(rev);
    });
  });

  describe("teams", () => {
    it("rebuilds teams when entering lobby_trivia (14 players → 4 teams)", () => {
      for (let i = 0; i < 14; i++) registerPlayer(`Player${i}`);
      advancePhase();
      const state = getSessionState();
      expect(state.guestStep).toBe("lobby_trivia");
      expect(state.teams).toHaveLength(4);
      const sizes = state.teams.map((t) => t.playerIds.length).sort((a, b) => b - a);
      expect(sizes).toEqual([4, 4, 3, 3]);
    });

    it("reshuffles teams for quotes after trivia", () => {
      for (let i = 0; i < 14; i++) registerPlayer(`P${i}`);
      while (getSessionState().guestStep !== "leaderboard_post_trivia") {
        stepForwardInTests();
      }
      const triviaTeams = JSON.stringify(
        getSessionState().teams.map((t) => [...t.playerIds].sort())
      );
      while (getSessionState().guestStep !== "lobby_quotes") {
        stepForwardInTests();
      }
      const quoteTeams = JSON.stringify(
        getSessionState().teams.map((t) => [...t.playerIds].sort())
      );
      expect(quoteTeams).not.toBe(triviaTeams);
    });
  });

  describe("getPublicState", () => {
    it("returns scheduled start time after host starts lobby countdown", () => {
      const id = registerPlayer("Alice");
      advancePhase();
      advancePhase();
      const publicState = getPublicState(id);
      expect(publicState.guestStep).toBe("lobby_trivia");
      expect(publicState.currentGame).toEqual(GAMES[0]);
      expect(publicState.scheduledGameStartsAtEpochMs).not.toBeNull();
    });

    it("returns myTeam during trivia lobby countdown", () => {
      const ids: string[] = [];
      for (let i = 0; i < 12; i++) ids.push(registerPlayer(`P${i}`));
      advancePhase();
      advancePhase();
      const publicState = getPublicState(ids[0]);
      expect(publicState.myTeam).toBeDefined();
      expect(publicState.myTeammateNicknames.length).toBeGreaterThanOrEqual(2);
    });

    it("hides myTeam during bingo lobby countdown", () => {
      const id = registerPlayer("Alice");
      while (getSessionState().guestStep !== "lobby_bingo") {
        stepForwardInTests();
      }
      advancePhase();
      expect(getPublicState(id).myTeam).toBeNull();
    });

    it("returns myTeam on post-trivia leaderboard for highlight UX", () => {
      const ids: string[] = [];
      for (let i = 0; i < 8; i++) ids.push(registerPlayer(`P${i}`));
      while (getSessionState().guestStep !== "leaderboard_post_trivia") {
        stepForwardInTests();
      }
      const pub = getPublicState(ids[0]);
      expect(pub.myTeam).toBeDefined();
      expect(pub.myTeam?.playerIds).toContain(ids[0]);
    });

    it("exposes lobbyTeams with nicknames on lobby_trivia", () => {
      const ids: string[] = [];
      for (let i = 0; i < 8; i++) ids.push(registerPlayer(`P${i}`));
      advancePhase();
      const pub = getPublicState(ids[0]);
      expect(pub.guestStep).toBe("lobby_trivia");
      expect(pub.lobbyTeams.length).toBeGreaterThanOrEqual(1);
      expect(pub.lobbyTeams.flatMap((t) => t.nicknames)).toContain("P0");
      expect(pub.playerCount).toBe(8);
    });

    it("clears lobbyTeams outside trivia lobby", () => {
      expect(getPublicState(null).lobbyTeams).toEqual([]);
      expect(getPublicState(null).playerCount).toBe(0);
    });

    it("playerKnownToSession is true when there is no cookie", () => {
      expect(getPublicState(null).playerKnownToSession).toBe(true);
    });

    it("playerKnownToSession is true when id matches a registered player", () => {
      const id = registerPlayer("Pat");
      expect(getPublicState(id).playerKnownToSession).toBe(true);
    });

    it("playerKnownToSession is false when cookie id is not in session (e.g. after reset)", () => {
      const id = registerPlayer("Gone");
      resetSession();
      expect(getPublicState(id).playerKnownToSession).toBe(false);
    });

    it("returns empty myTriviaVotes outside game_trivia", () => {
      const id = registerPlayer("Z");
      expect(getPublicState(id).myTriviaVotes).toEqual({});
    });

    it("returns myTriviaVotes during game_trivia", () => {
      const id = registerPlayer("Solo");
      while (getSessionState().guestStep !== "game_trivia") {
        stepForwardInTests();
      }
      submitTriviaVote(id, TRIVIA_QUESTIONS[0].id, 2);
      const pub = getPublicState(id);
      expect(pub.myTriviaVotes[TRIVIA_QUESTIONS[0].id]).toBe(2);
    });

    it("returns empty myQuoteVotes outside game_quotes", () => {
      const id = registerPlayer("Q");
      expect(getPublicState(id).myQuoteVotes).toEqual({});
    });

    it("returns myQuoteVotes during game_quotes", () => {
      const id = registerPlayer("QuotePlayer");
      while (getSessionState().guestStep !== "game_quotes") {
        stepForwardInTests();
      }
      const q0 = getQuoteQuestions()[0];
      submitQuoteVote(id, q0.id, 2);
      const pub = getPublicState(id);
      expect(pub.myQuoteVotes[q0.id]).toBe(2);
    });

    it("returns empty myBingoClaimedLineKeys outside game_bingo", () => {
      const id = registerPlayer("A");
      expect(getPublicState(id).myBingoClaimedLineKeys).toEqual([]);
      expect(getPublicState(id).myBingoScore).toBe(0);
    });

    it("exposes myBingoClaimedLineKeys and score during game_bingo after claims", () => {
      const id = registerPlayer("A");
      while (getSessionState().guestStep !== "game_bingo") {
        stepForwardInTests();
      }
      claimBingo(id, ["0,1,2"]);
      const pub = getPublicState(id);
      expect(pub.myBingoClaimedLineKeys).toContain("0,1,2");
      expect(pub.myBingoScore).toBe(500);
    });
  });

  describe("claimBingo", () => {
    function advanceUntil(step: GuestStep) {
      let guard = 0;
      while (getSessionState().guestStep !== step && guard < 30) {
        stepForwardInTests();
        guard++;
      }
      expect(getSessionState().guestStep).toBe(step);
    }

    it("returns null when not in game_bingo", () => {
      const id = registerPlayer("A");
      expect(claimBingo(id, ["0,1,2"])).toBeNull();
    });

    it("awards 500 per new valid line", () => {
      const id = registerPlayer("A");
      advanceUntil("game_bingo");
      const r = claimBingo(id, ["0,1,2"]);
      expect(r?.awarded).toBe(500);
      expect(r?.totalForPlayer).toBe(500);
      expect(r?.claimedLineKeys).toContain("0,1,2");
      expect(claimBingo(id, ["0,1,2"])?.awarded).toBe(0);
    });

    it("stacks points for multiple new lines in one claim", () => {
      const id = registerPlayer("A");
      advanceUntil("game_bingo");
      const r = claimBingo(id, ["0,1,2", "3,4,5"]);
      expect(r?.awarded).toBe(1000);
      expect(r?.totalForPlayer).toBe(1000);
    });

    it("ignores invalid line keys", () => {
      const id = registerPlayer("A");
      advanceUntil("game_bingo");
      expect(claimBingo(id, ["0,4"])?.awarded).toBe(0);
    });

    it("keeps live bingo scores on post-bingo leaderboard snapshot", () => {
      const id = registerPlayer("A");
      advanceUntil("game_bingo");
      claimBingo(id, ["0,1,2"]);
      advancePhase();
      expect(getSessionState().guestStep).toBe("leaderboard_post_bingo");
      const board = getSessionState().gameScores[GAMES[1].id]!;
      expect(board[id]).toBe(500);
    });
  });

  describe("rebuildTeams", () => {
    it("replaces existing teams", () => {
      registerPlayer("A");
      registerPlayer("B");
      rebuildTeams();
      const first = getSessionState().teams.map((t) => t.playerIds.slice().sort());
      rebuildTeams();
      const second = getSessionState().teams.map((t) => t.playerIds.slice().sort());
      expect(first.length).toBeGreaterThan(0);
      expect(second.length).toBeGreaterThan(0);
    });
  });

  describe("resetSession", () => {
    it("clears players, teams, scores and resets step", () => {
      registerPlayer("Alice");
      advancePhase();
      resetSession();
      const state = getSessionState();
      expect(state.guestStep).toBe("party_protocol");
      expect(state.players).toHaveLength(0);
      expect(state.teams).toHaveLength(0);
      expect(state.revision).toBe(0);
      expect(state.bingoClaimedLineKeysByPlayer).toEqual({});
      expect(state.triviaVotesByPlayer).toEqual({});
      expect(state.quoteVotesByPlayer).toEqual({});
    });
  });

  describe("quote game scoring", () => {
    it("awards 50 per correct team majority per quote (same as trivia)", () => {
      const a = registerPlayer("A");
      const b = registerPlayer("B");
      while (getSessionState().guestStep !== "game_quotes") {
        stepForwardInTests();
      }
      const q0 = getQuoteQuestions()[0];
      submitQuoteVote(a, q0.id, q0.correctIndex);
      submitQuoteVote(b, q0.id, q0.correctIndex);
      advancePhase();
      expect(getSessionState().guestStep).toBe("leaderboard_final");
      const board = getSessionState().gameScores[GAMES[2].id]!;
      expect(board[a]).toBe(50);
      expect(board[b]).toBe(50);
    });

    it("does not give points when team majority is wrong", () => {
      const a = registerPlayer("A");
      const b = registerPlayer("B");
      while (getSessionState().guestStep !== "game_quotes") {
        stepForwardInTests();
      }
      const q0 = getQuoteQuestions()[0];
      const wrong = q0.correctIndex === 0 ? 1 : 0;
      submitQuoteVote(a, q0.id, wrong);
      submitQuoteVote(b, q0.id, wrong);
      advancePhase();
      const board = getSessionState().gameScores[GAMES[2].id]!;
      expect(board[a]).toBe(0);
      expect(board[b]).toBe(0);
    });
  });

  describe("submitTriviaVote", () => {
    it("rejects when not in game_trivia", () => {
      const id = registerPlayer("A");
      const r = submitTriviaVote(id, TRIVIA_QUESTIONS[0].id, 0);
      expect(r).toEqual({ ok: false, error: "not_active" });
    });

    it("accepts votes during game_trivia", () => {
      const id = registerPlayer("A");
      while (getSessionState().guestStep !== "game_trivia") {
        stepForwardInTests();
      }
      expect(getSessionState().triviaVotesByPlayer).toEqual({});
      expect(submitTriviaVote(id, TRIVIA_QUESTIONS[0].id, 1).ok).toBe(true);
      expect(getSessionState().triviaVotesByPlayer[id]?.[TRIVIA_QUESTIONS[0].id]).toBe(
        1
      );
    });
  });

  describe("submitQuoteVote", () => {
    it("rejects when not in game_quotes", () => {
      const id = registerPlayer("A");
      const q0 = getQuoteQuestions()[0];
      const r = submitQuoteVote(id, q0.id, 0);
      expect(r).toEqual({ ok: false, error: "not_active" });
    });

    it("accepts votes during game_quotes", () => {
      const id = registerPlayer("A");
      while (getSessionState().guestStep !== "game_quotes") {
        stepForwardInTests();
      }
      const q0 = getQuoteQuestions()[0];
      expect(getSessionState().quoteVotesByPlayer).toEqual({});
      expect(submitQuoteVote(id, q0.id, 1).ok).toBe(true);
      expect(getSessionState().quoteVotesByPlayer[id]?.[q0.id]).toBe(1);
    });
  });
});
