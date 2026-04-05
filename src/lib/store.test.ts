import { bingoCardTitlesForPlayer } from "./bingoCard";
import { BINGO_CELL_COUNT } from "./bingoLine";
import {
  registerPlayer,
  getSessionState,
  getPublicState,
  advancePhase,
  resetSession,
  rebuildTeams,
  claimBingo,
  markBingoCell,
  setBingoPlaybackForTests,
  adminAdvanceBingoSong,
  submitTriviaVote,
  submitQuoteVote,
  buildTeamLeaderboardEntries,
} from "./store";
import { TEAM_MCQ_CYCLE_MS } from "./teamMcqTiming";
import { TRIVIA_QUESTIONS } from "@/content/trivia";
import { getQuoteQuestions } from "./quoteContent";
import { GAMES } from "./gameConfig";
import { GUEST_STEP_SEQUENCE, type GuestStep } from "@/types";

// Mock Supabase to keep tests local and fast.
jest.mock("./supabase");

jest.setTimeout(30000);
beforeEach(async () => {
  await resetSession();
});

/** Helper to advance through steps until a target is reached, with a safety guard. */
async function advanceUntil(target: GuestStep) {
  let guard = 0;
  while ((await getSessionState()).guestStep !== target && guard < 50) {
    await stepForwardInTests();
    guard++;
  }
  expect((await getSessionState()).guestStep).toBe(target);
}

/** Aligns playback with the player’s top row so server marks + claims stay valid. */
async function markTopRowForPlayer(playerId: string) {
  const titles = bingoCardTitlesForPlayer(playerId);
  const pad = "__pad__";
  const order = [titles[0]!, titles[1]!, titles[2]!, pad, pad, pad];
  await setBingoPlaybackForTests(order, 0);
  expect((await markBingoCell(playerId, 0, true)).ok).toBe(true);
  await setBingoPlaybackForTests(order, 1);
  expect((await markBingoCell(playerId, 1, true)).ok).toBe(true);
  await setBingoPlaybackForTests(order, 2);
  expect((await markBingoCell(playerId, 2, true)).ok).toBe(true);
}

async function markFullCardForPlayer(playerId: string) {
  const titles = bingoCardTitlesForPlayer(playerId);
  const order = [...titles, "__pad__"];
  for (let i = 0; i < BINGO_CELL_COUNT; i++) {
    await setBingoPlaybackForTests(order, i);
    expect((await markBingoCell(playerId, i, true)).ok).toBe(true);
  }
}

/**
 * One host “chapter” in tests: advance phase, and if the host just scheduled a lobby countdown
 * (same step + timestamp), jump to the game immediately.
 */
async function stepForwardInTests(): Promise<void> {
  const beforeStep = (await getSessionState()).guestStep;
  await advancePhase();
  const after = await getSessionState();
  if (
    after.guestStep === beforeStep &&
    after.scheduledGameStartsAtEpochMs != null
  ) {
    await advancePhase(after.scheduledGameStartsAtEpochMs + 1);
  }
}

describe("store", () => {
  describe("registerPlayer", () => {
    it("adds a player with unique id and nickname", async () => {
      const id = await registerPlayer("Alice");
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      const state = await getSessionState();
      expect(state.players).toHaveLength(1);
      expect(state.players[0]).toEqual({ id, nickname: "Alice" });
    });

    it("allows multiple players with different nicknames", async () => {
      const id1 = await registerPlayer("Alice");
      const id2 = await registerPlayer("Bob");
      expect(id1).not.toBe(id2);
      expect((await getSessionState()).players).toHaveLength(2);
    });
  });

  describe("getSessionState", () => {
    it("returns initial party_protocol and empty players", async () => {
      const state = await getSessionState();
      expect(state.guestStep).toBe("party_protocol");
      expect(state.revision).toBe(0);
      expect(state.scheduledGameStartsAtEpochMs).toBeNull();
      expect(state.players).toEqual([]);
      expect(state.teams).toEqual([]);
      expect(state.games).toEqual(GAMES);
    });
  });

  describe("advancePhase", () => {
    it("first advance moves to lobby_trivia and bumps revision", async () => {
      await registerPlayer("Alice");
      await advancePhase();
      const state = await getSessionState();
      expect(state.guestStep).toBe("lobby_trivia");
      expect(state.revision).toBe(1);
    });

    it("second advance from lobby schedules game start without changing step", async () => {
      await registerPlayer("Alice");
      await advancePhase();
      await advancePhase();
      const state = await getSessionState();
      expect(state.guestStep).toBe("lobby_trivia");
      expect(state.scheduledGameStartsAtEpochMs).not.toBeNull();
    });

    it("applyDueScheduledTransitions moves lobby into game_trivia and clears schedule", async () => {
      await registerPlayer("Alice");
      await advancePhase();
      await advancePhase();
      const startAt = (await getSessionState()).scheduledGameStartsAtEpochMs!;
      expect(startAt).toBeGreaterThan(Date.now());
      await advancePhase(startAt + 1);
      const after = await getSessionState();
      expect(after.guestStep).toBe("game_trivia");
      expect(after.scheduledGameStartsAtEpochMs).toBeNull();
      expect(after.revision).toBeGreaterThan(0);
    });

    it("from game_trivia moves to leaderboard and records scores", async () => {
      await registerPlayer("Alice");
      await registerPlayer("Bob");
      await stepForwardInTests();
      await stepForwardInTests();
      await advancePhase();
      const state = await getSessionState();
      expect(state.guestStep).toBe("leaderboard_post_trivia");
      expect(state.gameScores[GAMES[0].id]).toBeDefined();
    });

    it("trivia leaderboard uses majority team scoring (+50 per correct question per player)", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) ids.push(await registerPlayer(`P${i}`));
      await advanceUntil("game_trivia");
      const teams = (await getSessionState()).teams;
      const teamA = teams[0]!;
      let now = Date.now();
      for (let qi = 0; qi < TRIVIA_QUESTIONS.length; qi++) {
        const q = TRIVIA_QUESTIONS[qi]!;
        for (const pid of teamA.playerIds) {
          expect((await submitTriviaVote(pid, q.id, q.correctIndex)).ok).toBe(true);
        }
        const currentState = await getSessionState();
        now = (currentState.teamMcqRoundStartedAtEpochMs ?? now) + TEAM_MCQ_CYCLE_MS;
        await getSessionState(now);
      }
      await advancePhase();
      const board = (await getSessionState()).gameScores[GAMES[0].id]!;
      const expected = TRIVIA_QUESTIONS.length * 50;
      teamA.playerIds.forEach((pid) => {
        expect(board[pid]).toBe(expected);
      });
    });

    it("gives all teammates the same round score for team games", async () => {
      for (let i = 0; i < 6; i++) await registerPlayer(`P${i}`);
      await advanceUntil("leaderboard_post_trivia");
      const state = await getSessionState();
      const board = state.gameScores[GAMES[0].id]!;
      const teams = state.teams;
      teams.forEach((t) => {
        const pts = t.playerIds.map((id) => board[id]);
        const first = pts[0];
        expect(first).toBeDefined();
        pts.forEach((p) => expect(p).toBe(first));
      });
    });

    it("runs full sequence to leaderboard_final", async () => {
      await registerPlayer("Alice");
      for (let i = 0; i < GUEST_STEP_SEQUENCE.length - 1; i++) {
        await stepForwardInTests();
      }
      expect((await getSessionState()).guestStep).toBe("leaderboard_final");
    });

    it("does not advance past leaderboard_final", async () => {
      await registerPlayer("Alice");
      for (let i = 0; i < GUEST_STEP_SEQUENCE.length - 1; i++) {
        await stepForwardInTests();
      }
      const rev = (await getSessionState()).revision;
      await advancePhase();
      const after = await getSessionState();
      expect(after.guestStep).toBe("leaderboard_final");
      expect(after.revision).toBe(rev);
    });
  });

  describe("teams", () => {
    it("rebuilds teams when entering lobby_trivia (14 players → 4 teams)", async () => {
      for (let i = 0; i < 14; i++) await registerPlayer(`Player${i}`);
      await advancePhase();
      const state = await getSessionState();
      expect(state.guestStep).toBe("lobby_trivia");
      expect(state.teams).toHaveLength(4);
      const sizes = state.teams.map((t) => t.playerIds.length).sort((a, b) => b - a);
      expect(sizes).toEqual([4, 4, 3, 3]);
    });

    it("reshuffles teams for quotes after trivia", async () => {
      for (let i = 0; i < 14; i++) await registerPlayer(`P${i}`);
      await advanceUntil("leaderboard_post_trivia");
      const triviaTeams = JSON.stringify(
        (await getSessionState()).teams.map((t) => [...t.playerIds].sort())
      );
      await advanceUntil("lobby_quotes");
      const quoteTeams = JSON.stringify(
        (await getSessionState()).teams.map((t) => [...t.playerIds].sort())
      );
      expect(quoteTeams).not.toBe(triviaTeams);
    });
  });

  describe("getPublicState", () => {
    it("returns scheduled start time after host starts lobby countdown", async () => {
      const id = await registerPlayer("Alice");
      await advancePhase();
      await advancePhase();
      const publicState = await getPublicState(id);
      expect(publicState.guestStep).toBe("lobby_trivia");
      expect(publicState.currentGame).toEqual(GAMES[0]);
      expect(publicState.scheduledGameStartsAtEpochMs).not.toBeNull();
    });

    it("returns myTeam during trivia lobby countdown", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 12; i++) ids.push(await registerPlayer(`P${i}`));
      await advancePhase();
      await advancePhase();
      const publicState = await getPublicState(ids[0]);
      expect(publicState.myTeam).toBeDefined();
      expect(publicState.myTeammateNicknames.length).toBeGreaterThanOrEqual(2);
    });

    it("hides myTeam during bingo lobby countdown", async () => {
      const id = await registerPlayer("Alice");
      await advanceUntil("lobby_bingo");
      await advancePhase();
      expect((await getPublicState(id)).myTeam).toBeNull();
    });

    it("returns myTeam on post-trivia leaderboard for highlight UX", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 8; i++) ids.push(await registerPlayer(`P${i}`));
      await advanceUntil("leaderboard_post_trivia");
      const pub = await getPublicState(ids[0]);
      expect(pub.myTeam).toBeDefined();
      expect(pub.myTeam?.playerIds).toContain(ids[0]);
    });

    it("exposes lobbyTeams with nicknames on lobby_trivia", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 8; i++) ids.push(await registerPlayer(`P${i}`));
      await advancePhase();
      const pub = await getPublicState(ids[0]);
      expect(pub.guestStep).toBe("lobby_trivia");
      expect(pub.lobbyTeams.length).toBeGreaterThanOrEqual(1);
      expect(pub.lobbyTeams.flatMap((t) => t.nicknames)).toContain("P0");
      expect(pub.playerCount).toBe(8);
    });

    it("clears lobbyTeams outside trivia lobby", async () => {
      expect((await getPublicState(null)).lobbyTeams).toEqual([]);
      expect((await getPublicState(null)).playerCount).toBe(0);
    });

    it("playerKnownToSession is true when there is no cookie", async () => {
      expect((await getPublicState(null)).playerKnownToSession).toBe(true);
    });

    it("playerKnownToSession is true when id matches a registered player", async () => {
      const id = await registerPlayer("Pat");
      expect((await getPublicState(id)).playerKnownToSession).toBe(true);
    });

    it("playerKnownToSession is false when cookie id is not in session (e.g. after reset)", async () => {
      const id = await registerPlayer("Gone");
      await resetSession();
      expect((await getPublicState(id)).playerKnownToSession).toBe(false);
    });

    it("returns empty myTriviaVotes outside game_trivia", async () => {
      const id = await registerPlayer("Z");
      expect((await getPublicState(id)).myTriviaVotes).toEqual({});
    });

    it("returns myTriviaVotes during game_trivia", async () => {
      const id = await registerPlayer("Solo");
      await advanceUntil("game_trivia");
      await submitTriviaVote(id, TRIVIA_QUESTIONS[0].id, 2);
      const pub = await getPublicState(id);
      expect(pub.myTriviaVotes[TRIVIA_QUESTIONS[0].id]).toBe(2);
      expect(pub.teamMcqSync).not.toBeNull();
      expect(pub.teamMcqSync?.questionIndex).toBe(0);
    });

    it("returns empty myQuoteVotes outside game_quotes", async () => {
      const id = await registerPlayer("Q");
      expect((await getPublicState(id)).myQuoteVotes).toEqual({});
    });

    it("returns myQuoteVotes during game_quotes", async () => {
      const id = await registerPlayer("QuotePlayer");
      await advanceUntil("game_quotes");
      const q0 = getQuoteQuestions()[0];
      await submitQuoteVote(id, q0.id, 2);
      const pub = await getPublicState(id);
      expect(pub.myQuoteVotes[q0.id]).toBe(2);
      expect(pub.teamMcqSync?.questionIndex).toBe(0);
    });

    it("returns empty myBingoClaimedLineKeys outside game_bingo", async () => {
      const id = await registerPlayer("A");
      const pub = await getPublicState(id);
      expect(pub.myBingoClaimedLineKeys).toEqual([]);
      expect(pub.myBingoScore).toBe(0);
      expect(pub.bingoRoundEndsAtEpochMs).toBeNull();
      expect(pub.myBingoMarkedCells).toEqual([]);
    });

    it("exposes bingo countdown, marks, myBingoClaimedLineKeys and score during game_bingo", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_bingo");
      const pub0 = await getPublicState(id);
      expect(pub0.bingoRoundEndsAtEpochMs).toBeGreaterThan(Date.now());
      await markTopRowForPlayer(id);
      await claimBingo(id, ["0,1,2"]);
      const pub = await getPublicState(id);
      expect(pub.myBingoClaimedLineKeys).toContain("0,1,2");
      expect(pub.myBingoScore).toBe(100);
      expect(pub.myBingoMarkedCells.slice(0, 3)).toEqual([true, true, true]);
    });
  });

  describe("claimBingo", () => {
    it("returns null when not in game_bingo", async () => {
      const id = await registerPlayer("A");
      expect(await claimBingo(id, ["0,1,2"])).toBeNull();
    });

    it("awards 100 for a new row and 50 for a new column", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_bingo");
      await markTopRowForPlayer(id);
      const topRow = await claimBingo(id, ["0,1,2"]);
      expect(topRow?.awarded).toBe(100);
      expect(topRow?.totalForPlayer).toBe(100);
      const titles = bingoCardTitlesForPlayer(id);
      const pad = "__pad__";
      await setBingoPlaybackForTests([titles[0]!, titles[3]!, pad, pad, pad, pad], 0);
      await markBingoCell(id, 0, true);
      await setBingoPlaybackForTests([titles[0]!, titles[3]!, pad, pad, pad, pad], 1);
      await markBingoCell(id, 3, true);
      const col = await claimBingo(id, ["0,3"]);
      expect(col?.awarded).toBe(50);
      expect(col?.totalForPlayer).toBe(150);
      expect((await claimBingo(id, ["0,1,2"]))?.awarded).toBe(0);
    });

    it("stacks points for multiple new lines in one claim", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_bingo");
      await markFullCardForPlayer(id);
      const r = await claimBingo(id, ["0,1,2", "3,4,5"]);
      expect(r?.awarded).toBe(200);
      expect(r?.totalForPlayer).toBe(200);
    });

    it("awards 500 once for the full-card key when every cell is marked", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_bingo");
      await markFullCardForPlayer(id);
      const r = await claimBingo(id, ["full"]);
      expect(r?.awarded).toBe(500);
      expect(r?.totalForPlayer).toBe(500);
      expect(r?.claimedLineKeys).toContain("full");
      expect((await claimBingo(id, ["full"]))?.awarded).toBe(0);
    });

    it("combines lines and full-card points in one claim", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_bingo");
      await markFullCardForPlayer(id);
      const r = await claimBingo(id, ["0,1,2", "3,4,5", "0,3", "1,4", "2,5", "full"]);
      expect(r?.awarded).toBe(850);
      expect(r?.totalForPlayer).toBe(850);
    });

    it("ignores invalid line keys", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_bingo");
      expect((await claimBingo(id, ["0,4"]))?.awarded).toBe(0);
    });

    it("keeps live bingo scores on post-bingo leaderboard snapshot", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_bingo");
      await markTopRowForPlayer(id);
      await claimBingo(id, ["0,1,2"]);
      await advancePhase();
      expect((await getSessionState()).guestStep).toBe("leaderboard_post_bingo");
      const board = (await getSessionState()).gameScores[GAMES[1].id]!;
      expect(board[id]).toBe(100);
    });

    it("does not award lines that are not fully marked on the server", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_bingo");
      expect((await claimBingo(id, ["0,1,2"]))?.awarded).toBe(0);
    });
  });

  describe("markBingoCell", () => {
    it("applies a penalty when marking a tile that is not the current song", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_bingo");
      const titles = bingoCardTitlesForPlayer(id);
      setBingoPlaybackForTests([titles[0]!], 0);
      const r = await markBingoCell(id, 4, true);
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error("expected markBingoCell success");
      expect(r.wrongTapPenalty).toBe(true);
      const state = await getSessionState();
      expect(state.gameScores[GAMES[1].id]![id]).toBe(-5);
      expect(r.marked[4]).toBe(false);
    });

    it("advances the host playhead with adminAdvanceBingoSong", async () => {
      await registerPlayer("A");
      await advanceUntil("game_bingo");
      expect(await adminAdvanceBingoSong()).toEqual({ ok: true });
      expect((await getSessionState()).bingoCurrentSongIndex).toBe(1);
    });
  });

  describe("applyDueBingoRoundEnd", () => {
    it("moves to bingo leaderboard and records scores when the round timer is past", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_bingo");
      await markTopRowForPlayer(id);
      await claimBingo(id, ["0,1,2"]);
      const endAt = (await getSessionState()).bingoRoundEndsAtEpochMs!;
      jest.useFakeTimers({ now: endAt + 2_000, advanceTimers: true });
      // Trigger update check
      await getSessionState();
      expect((await getSessionState()).guestStep).toBe("leaderboard_post_bingo");
      expect((await getSessionState()).gameScores[GAMES[1].id]![id]).toBe(100);
      jest.useRealTimers();
    });
  });

  describe("rebuildTeams", () => {
    it("replaces existing teams", async () => {
      await registerPlayer("A");
      await registerPlayer("B");
      await rebuildTeams();
      const first = (await getSessionState()).teams.map((t) => t.playerIds.slice().sort());
      await rebuildTeams();
      const second = (await getSessionState()).teams.map((t) => t.playerIds.slice().sort());
      expect(first.length).toBeGreaterThan(0);
      expect(second.length).toBeGreaterThan(0);
    });
  });

  describe("resetSession", () => {
    it("clears players, teams, scores and resets step", async () => {
      await registerPlayer("Alice");
      await advancePhase();
      await resetSession();
      const state = await getSessionState();
      expect(state.guestStep).toBe("party_protocol");
      expect(state.players).toHaveLength(0);
      expect(state.teams).toHaveLength(0);
      expect(state.revision).toBe(0);
      expect(state.bingoClaimedLineKeysByPlayer).toEqual({});
      expect(state.bingoMarkedByPlayer).toEqual({});
      expect(state.bingoSongOrder).toEqual([]);
      expect(state.triviaVotesByPlayer).toEqual({});
      expect(state.quoteVotesByPlayer).toEqual({});
      expect(state.teamMcqRoundIndex).toBe(0);
      expect(state.teamMcqRoundStartedAtEpochMs).toBeNull();
    });
  });

  describe("quote game scoring", () => {
    it("awards 50 per correct team majority per quote (same as trivia)", async () => {
      const a = await registerPlayer("A");
      const b = await registerPlayer("B");
      await advanceUntil("game_quotes");
      const q0 = getQuoteQuestions()[0];
      await submitQuoteVote(a, q0.id, q0.correctIndex);
      await submitQuoteVote(b, q0.id, q0.correctIndex);
      await advancePhase();
      expect((await getSessionState()).guestStep).toBe("leaderboard_final");
      const board = (await getSessionState()).gameScores[GAMES[2].id]!;
      expect(board[a]).toBe(50);
      expect(board[b]).toBe(50);
    });

    it("does not give points when team majority is wrong", async () => {
      const a = await registerPlayer("A");
      const b = await registerPlayer("B");
      await advanceUntil("game_quotes");
      const q0 = getQuoteQuestions()[0];
      const wrong = q0.correctIndex === 0 ? 1 : 0;
      await submitQuoteVote(a, q0.id, wrong);
      await submitQuoteVote(b, q0.id, wrong);
      await advancePhase();
      const board = (await getSessionState()).gameScores[GAMES[2].id]!;
      expect(board[a]).toBe(0);
      expect(board[b]).toBe(0);
    });
  });

  describe("submitTriviaVote", () => {
    it("rejects when not in game_trivia", async () => {
      const id = await registerPlayer("A");
      const r = await submitTriviaVote(id, TRIVIA_QUESTIONS[0].id, 0);
      expect(r).toEqual({ ok: false, error: "not_active" });
    });

    it("accepts votes during game_trivia", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_trivia");
      const stateBefore = await getSessionState();
      expect(stateBefore.triviaVotesByPlayer).toEqual({});
      expect((await submitTriviaVote(id, TRIVIA_QUESTIONS[0].id, 1)).ok).toBe(true);
      const stateAfter = await getSessionState();
      expect(stateAfter.triviaVotesByPlayer[id]?.[TRIVIA_QUESTIONS[0].id]).toBe(1);
    });

    it("rejects vote for a question that is not the active round", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_trivia");
      const wrongId = TRIVIA_QUESTIONS[1]!.id;
      expect(await submitTriviaVote(id, wrongId, 0)).toEqual({
        ok: false,
        error: "wrong_question",
      });
    });
  });

  describe("submitQuoteVote", () => {
    it("rejects when not in game_quotes", async () => {
      const id = await registerPlayer("A");
      const q0 = getQuoteQuestions()[0];
      const r = await submitQuoteVote(id, q0.id, 0);
      expect(r).toEqual({ ok: false, error: "not_active" });
    });

    it("accepts votes during game_quotes", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_quotes");
      const q0 = getQuoteQuestions()[0];
      const stateBefore = await getSessionState();
      expect(stateBefore.quoteVotesByPlayer).toEqual({});
      expect((await submitQuoteVote(id, q0.id, 1)).ok).toBe(true);
      const stateAfter = await getSessionState();
      expect(stateAfter.quoteVotesByPlayer[id]?.[q0.id]).toBe(1);
    });

    it("rejects quote vote when not the active question", async () => {
      const id = await registerPlayer("A");
      await advanceUntil("game_quotes");
      const q1 = getQuoteQuestions()[1]!;
      expect(await submitQuoteVote(id, q1.id, 0)).toEqual({
        ok: false,
        error: "wrong_question",
      });
    });
  });

  describe("applyDueTeamMcqRoundAdvance", () => {
    it("advances question index after each full cycle on the server timeline", async () => {
      await registerPlayer("A");
      await advanceUntil("game_trivia");
      const t0 = (await getSessionState()).teamMcqRoundStartedAtEpochMs!;
      expect((await getSessionState()).teamMcqRoundIndex).toBe(0);
      await advancePhase(t0 + TEAM_MCQ_CYCLE_MS + 1);
      const after = await getSessionState();
      expect(after.teamMcqRoundIndex).toBe(1);
      expect(after.teamMcqRoundStartedAtEpochMs).toBe(t0 + TEAM_MCQ_CYCLE_MS);
    });
  });

  describe("leaderboard display", () => {
    it("aggregates team player scores for team leaderboard entries", () => {
      const entries = buildTeamLeaderboardEntries(
        [
          { id: "teamA", name: "Team A", playerIds: ["p1", "p2"] },
          { id: "teamB", name: "Team B", playerIds: ["p3"] },
        ],
        {
          p1: 100,
          p2: 150,
          p3: 80,
        }
      );
      expect(entries).toEqual([
        { name: "Team A", score: 250 },
        { name: "Team B", score: 80 },
      ]);
    });

    it("team leaderboard after trivia shows team names from the leaderboard", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) ids.push(await registerPlayer(`P${i}`));

      await advanceUntil("leaderboard_post_trivia");

      const pub = await getPublicState(ids[0]);
      const leaderboard = pub.leaderboard;

      // After trivia, leaderboard should contain entries
      expect(leaderboard.length).toBeGreaterThan(0);

      // Leaderboard entries should have team names (not individual player nicknames)
      const state = await getSessionState();
      const teamNames = state.teams.map(t => t.name);
      const playerNicknames = state.players.map(p => p.nickname);

      leaderboard.forEach(entry => {
        // Should be a team name (like "Team 1"), not a player nickname
        expect(teamNames).toContain(entry.name);
        expect(playerNicknames).not.toContain(entry.name);
      });
    });

    it("individual leaderboard after bingo shows player names and scores", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) ids.push(await registerPlayer(`P${i}`));

      await advanceUntil("leaderboard_post_bingo");

      const pub = await getPublicState(ids[0]);
      const leaderboard = pub.leaderboard;

      // After bingo, leaderboard should contain individual player entries
      expect(leaderboard.length).toBeGreaterThan(0);

      // Leaderboard entries should have player nicknames
      const state = await getSessionState();
      const playerNicknames = state.players.map(p => p.nickname);
      leaderboard.forEach(entry => {
        expect(playerNicknames).toContain(entry.name);
      });
    });

    it("final leaderboard has valid scores with cumulative totals", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 8; i++) ids.push(await registerPlayer(`P${i}`));

      await advanceUntil("leaderboard_final");

      const state = await getSessionState();
      const pub = await getPublicState(ids[0]);
      const finalLeaderboard = pub.finalLeaderboard;

      // Final leaderboard should have entries for each unique player
      expect(finalLeaderboard.length).toBe(ids.length);

      // All entries should have valid scores (non-negative)
      finalLeaderboard.forEach(entry => {
        expect(entry.totalScore).toBeGreaterThanOrEqual(0);
        expect(typeof entry.totalScore).toBe("number");
        expect(typeof entry.nickname).toBe("string");
      });

      // Check that each player appears exactly once
      const nicknames = finalLeaderboard.map(e => e.nickname);
      const uniqueNicknames = new Set(nicknames);
      expect(uniqueNicknames.size).toBe(ids.length);
    });

    it("team leaderboard entries reflect all team members' scores correctly", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) ids.push(await registerPlayer(`P${i}`));

      await advanceUntil("leaderboard_post_trivia");

      const pub = await getPublicState(ids[0]);
      const leaderboard = pub.leaderboard;
      const state = await getSessionState();
      const gameScores = state.gameScores[GAMES[0].id]!;
      const teams = state.teams;

      // Verify each team's leaderboard entry score matches the sum of its members' scores
      expect(leaderboard.length).toBeGreaterThan(0);
      leaderboard.forEach(entry => {
        const matchingTeam = teams.find(t => t.name === entry.name);
        expect(matchingTeam).toBeDefined();

        if (matchingTeam) {
          const memberScores = matchingTeam.playerIds.map(pid => gameScores[pid] ?? 0);
          const teamTotal = memberScores.reduce((sum, s) => sum + s, 0);

          // The leaderboard entry should show team total score
          expect(entry.score).toBe(teamTotal);
        }
      });
    });
  });
});
