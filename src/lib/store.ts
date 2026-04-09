import type {
  GuestStep,
  GameConfig,
  LobbyTeamRoster,
  Team,
  SessionState,
  PublicState,
} from "@/types";
import {
  getNextGuestStep,
  gameSlotFromGuestStep,
  publicGameIndexFromGuestStep,
} from "@/types";
import { GAMES } from "./gameConfig";
import { BINGO_SONG_TITLES } from "@/content/bingo";
import { bingoCardTitlesForPlayer } from "./bingoCard";
import { BINGO_ROUND_DURATION_MS, BINGO_WRONG_TAP_PENALTY } from "./bingoRound";
import {
  BINGO_CELL_COUNT,
  BINGO_FULL_CARD_CLAIM_KEY,
  BINGO_POINTS_FULL_CARD,
  BINGO_VALID_LINE_KEYS,
  bingoIndicesForLineKey,
  bingoPointsForValidLineKey,
} from "./bingoLine";
import { sortLeaderboardEntries } from "./leaderboardSort";
import { notifySessionChanged } from "./sessionNotify";
import { TRIVIA_QUESTIONS } from "@/content/trivia";
import {
  computeTriviaScoresFromVotes,
  isValidTriviaOptionIndex,
} from "./triviaScoring";
import { getQuoteQuestions } from "./quoteContent";
import { teamsFromShuffledPlayerIds } from "./teamFormation";
import { LOBBY_PRE_GAME_LEAD_MS } from "./lobbySchedule";
import {
  TEAM_MCQ_ANSWER_MS,
  TEAM_MCQ_CYCLE_MS,
  TEAM_MCQ_REVEAL_MS,
} from "./teamMcqTiming";
import { supabase } from "./supabase";

const BINGO_GAME_ID = GAMES[1]?.id ?? "game-bingo";
const TRIVIA_GAME_ID = GAMES[0]?.id ?? "game-trivia";
const QUOTES_GAME_ID = GAMES[2]?.id ?? "game-quotes";

type DbPlayer = { id: string; nickname: string };
type DbTeam = { id: string; name: string; game_id: string | null };
type DbMembership = { team_id: string; player_id: string };
type DbScore = { game_id: string; player_id: string; score: number };
type DbVote = { player_id: string; game_id: string; question_id: string; option_index: number };
type DbMark = { player_id: string; cell_index: number };
type DbClaim = { player_id: string; line_key: string };

type DbSessionRow = {
  guest_step?: SessionState["guestStep"];
  revision?: number;
  scheduled_start_ms?: unknown;
  mcq_round_index?: number;
  mcq_round_start_ms?: unknown;
  bingo_song_order?: string[];
  bingo_current_index?: number;
  bingo_round_end_ms?: unknown;
};

const TRIVIA_QUESTION_IDS = new Set(TRIVIA_QUESTIONS.map((q) => q.id));

function quoteQuestionIds(): Set<string> {
  return new Set(getQuoteQuestions().map((q) => q.id));
}

const LOBBY_STEPS_WITH_SCHEDULE = new Set<GuestStep>([
  "lobby_trivia",
  "lobby_bingo",
  "lobby_quotes",
]);

/** 
 * Fetches the shared session state from Supabase by aggregating multiple tables (v2.0 relational schema).
 */
async function getStoreState(): Promise<SessionState> {
  // 1. Core Session State (Explicit columns)
  const sessionResponse = await supabase
    .from("session")
    .select("*")
    .eq("id", 1)
    .single();
  const sessionData = sessionResponse.data as DbSessionRow | null;

  const session: SessionState = {
    guestStep: (sessionData?.guest_step as GuestStep) || "party_protocol",
    revision: sessionData?.revision || 0,
    scheduledGameStartsAtEpochMs: sessionData?.scheduled_start_ms ? Number(sessionData.scheduled_start_ms) : null,
    teamMcqRoundIndex: sessionData?.mcq_round_index || 0,
    teamMcqRoundStartedAtEpochMs: sessionData?.mcq_round_start_ms ? Number(sessionData.mcq_round_start_ms) : null,
    games: [...GAMES],
    bingoSongOrder: sessionData?.bingo_song_order || [],
    bingoCurrentSongIndex: sessionData?.bingo_current_index || 0,
    bingoRoundEndsAtEpochMs: sessionData?.bingo_round_end_ms ? Number(sessionData.bingo_round_end_ms) : null,
    players: [],
    teams: [],
    gameScores: {},
    bingoClaimedLineKeysByPlayer: {},
    bingoMarkedByPlayer: {},
    triviaVotesByPlayer: {},
    quoteVotesByPlayer: {},
  };

  // 2. Fetch all related tables
  const [
    { data: players },
    { data: teams },
    { data: membership },
    { data: scores },
    { data: votes },
    { data: marks },
    { data: claims },
  ] = await Promise.all([
    supabase.from("players").select("*"),
    supabase.from("teams").select("*"),
    supabase.from("team_membership").select("*"),
    supabase.from("game_scores").select("*"),
    supabase.from("votes").select("*"),
    supabase.from("bingo_marks").select("*"),
    supabase.from("bingo_claims").select("*"),
  ]);

  const dbPlayers = (players || []) as DbPlayer[];
  const dbTeams = (teams || []) as DbTeam[];
  const dbMembership = (membership || []) as DbMembership[];
  const dbScores = (scores || []) as DbScore[];
  const dbVotes = (votes || []) as DbVote[];
  const dbMarks = (marks || []) as DbMark[];
  const dbClaims = (claims || []) as DbClaim[];

  // Map Players
  session.players = dbPlayers.map((p) => ({ id: p.id, nickname: p.nickname }));

  // Map Teams & Membership (Filtered by current game context)
  const currentSlot = gameSlotFromGuestStep(session.guestStep);
  const activeGameId = currentSlot === null ? null : GAMES[currentSlot]?.id;

  session.teams = dbTeams
    .filter((t) => activeGameId === null || t.game_id === activeGameId)
    .map((t) => ({
      id: t.id,
      name: t.name,
      playerIds: dbMembership
        .filter((m) => m.team_id === t.id)
        .map((m) => m.player_id),
    }));

  // Map Scores
  dbScores.forEach((s) => {
    if (!session.gameScores[s.game_id]) session.gameScores[s.game_id] = {};
    session.gameScores[s.game_id][s.player_id] = s.score;
  });

  // Map Votes
  dbVotes.forEach((v) => {
    const targetMap = v.game_id === TRIVIA_GAME_ID ? session.triviaVotesByPlayer : session.quoteVotesByPlayer;
    if (!targetMap[v.player_id]) targetMap[v.player_id] = {};
    targetMap[v.player_id][v.question_id] = v.option_index;
  });

  dbMarks.forEach((m) => {
    if (!session.bingoMarkedByPlayer[m.player_id]) {
      session.bingoMarkedByPlayer[m.player_id] = Array.from({ length: 6 }, () => false);
    }
    const idx = Number(m.cell_index);
    if (idx >= 0 && idx < 6) {
      session.bingoMarkedByPlayer[m.player_id][idx] = true;
    }
  });
  dbClaims.forEach((c) => {
    if (!session.bingoClaimedLineKeysByPlayer[c.player_id]) {
      session.bingoClaimedLineKeysByPlayer[c.player_id] = [];
    }
    session.bingoClaimedLineKeysByPlayer[c.player_id].push(c.line_key);
  });

  return session;
}

/** Persists core session variables. */
async function commitCoreState(state: SessionState): Promise<void> {
  await supabase
    .from("session")
    .upsert({
      id: 1,
      guest_step: state.guestStep,
      revision: state.revision,
      scheduled_start_ms: state.scheduledGameStartsAtEpochMs,
      mcq_round_index: state.teamMcqRoundIndex,
      mcq_round_start_ms: state.teamMcqRoundStartedAtEpochMs,
      bingo_song_order: state.bingoSongOrder,
      bingo_current_index: state.bingoCurrentSongIndex,
      bingo_round_end_ms: state.bingoRoundEndsAtEpochMs,
      updated_at: new Date().toISOString(),
    });
}

/** Persists teams and their memberships. */
async function commitTeamsAndMembership(state: SessionState): Promise<void> {
  const currentSlot = gameSlotFromGuestStep(state.guestStep);
  const activeGameId = currentSlot === null ? null : GAMES[currentSlot]?.id;

  if (state.teams.length > 0) {
    const teamOps = state.teams.map(async (t) => {
      await supabase.from("teams").upsert({ id: t.id, game_id: activeGameId ?? null, name: t.name });
      await supabase.from("team_membership").delete().eq("team_id", t.id);
      if (t.playerIds.length > 0) {
        await supabase.from("team_membership").insert(
          t.playerIds.map((pid) => ({ team_id: t.id, player_id: pid }))
        );
      }
    });
    await Promise.all(teamOps);
  }
}

/** Persists scores and votes. */
async function commitScoresAndVotes(state: SessionState): Promise<void> {
  const scoreOps = Object.entries(state.gameScores).flatMap(([gameId, scores]) =>
    Object.entries(scores).map(([playerId, score]) =>
      supabase.from("game_scores").upsert({ game_id: gameId, player_id: playerId, score })
    )
  );

  const triviaVoteOps = Object.entries(state.triviaVotesByPlayer).flatMap(([pid, vmap]) =>
    Object.entries(vmap).map(([qid, oidx]) =>
      supabase.from("votes").upsert({ player_id: pid, game_id: TRIVIA_GAME_ID, question_id: qid, option_index: oidx })
    )
  );

  const quoteVoteOps = Object.entries(state.quoteVotesByPlayer).flatMap(([pid, vmap]) =>
    Object.entries(vmap).map(([qid, oidx]) =>
      supabase.from("votes").upsert({ player_id: pid, game_id: QUOTES_GAME_ID, question_id: qid, option_index: oidx })
    )
  );

  await Promise.all([...scoreOps, ...triviaVoteOps, ...quoteVoteOps]);
}

/** Persists bingo state progress. */
async function commitBingoProgress(state: SessionState): Promise<void> {
  const bingoMarkOps = Object.entries(state.bingoMarkedByPlayer).flatMap(([pid, markedArr]) =>
    markedArr.map((marked, ci) =>
      marked
        ? supabase.from("bingo_marks").upsert({ player_id: pid, cell_index: ci })
        : supabase.from("bingo_marks").delete().match({ player_id: pid, cell_index: ci })
    )
  );

  const bingoClaimOps = Object.entries(state.bingoClaimedLineKeysByPlayer).flatMap(([pid, keys]) =>
    keys.map((k) => supabase.from("bingo_claims").upsert({ player_id: pid, line_key: k }))
  );

  await Promise.all([...bingoMarkOps, ...bingoClaimOps]);
}

export type SessionCommitOptions = {
  /**
   * When true, rewrites `teams` + `team_membership` from `state.teams`.
   * Must run after `internalRebuildTeams` (entering trivia/quotes lobby).
   * Default false: avoids wiping late-join `team_membership` rows when another request
   * commits votes/scores with a stale in-memory roster (serverless overlap).
   */
  persistTeams?: boolean;
};

/** Persists the modified state back to the relational tables (v2.0 schema). */
async function commitState(
  state: SessionState,
  options?: SessionCommitOptions,
): Promise<void> {
  const persistTeams = options?.persistTeams === true;
  await Promise.all([
    commitCoreState(state),
    ...(persistTeams ? [commitTeamsAndMembership(state)] : []),
    commitScoresAndVotes(state),
    commitBingoProgress(state),
  ]);
}

/** Test hook: same as internal commit; use `persistTeams` to mirror production lobby rebuilds. */
export async function applySessionCommitForTests(
  state: SessionState,
  options?: SessionCommitOptions,
): Promise<void> {
  await commitState(state, options);
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 12);
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Helper to update teams in a state object before committing. */
async function internalRebuildTeams(state: SessionState): Promise<void> {
  const ids = [...state.players].map((p) => p.id);
  shuffle(ids);
  state.teams = teamsFromShuffledPlayerIds(ids);
}

export async function rebuildTeams(): Promise<void> {
  const state = await getStoreState();
  await internalRebuildTeams(state);
  await commitState(state, { persistTeams: true });
  notifySessionChanged();
}

/** 
 * Checks and apply any due step advances (lobby -> game) based on scheduled timestamps.
 * Returns true if state was changed.
 */
async function applyDueScheduledTransitions(
  state: SessionState,
  nowMs: number,
): Promise<{ changed: boolean; persistTeams: boolean }> {
  if (state.scheduledGameStartsAtEpochMs == null) {
    return { changed: false, persistTeams: false };
  }
  if (!LOBBY_STEPS_WITH_SCHEDULE.has(state.guestStep)) {
    return { changed: false, persistTeams: false };
  }
  if (nowMs < state.scheduledGameStartsAtEpochMs) {
    return { changed: false, persistTeams: false };
  }

  const from = state.guestStep;
  let to: GuestStep;
  if (from === "lobby_trivia") {
    to = "game_trivia";
  } else if (from === "lobby_bingo") {
    to = "game_bingo";
  } else {
    to = "game_quotes";
  }

  const transitionAtMs = state.scheduledGameStartsAtEpochMs ?? nowMs;
  const persistTeams = await applyTransitionSideEffects(state, from, to, transitionAtMs);
  state.guestStep = to;
  state.scheduledGameStartsAtEpochMs = null;
  state.revision += 1;
  return { changed: true, persistTeams };
}

/** 
 * Checks and apply any due bingo round ends.
 * Returns true if state was changed.
 */
async function applyDueBingoRoundEnd(
  state: SessionState,
  nowMs: number,
): Promise<{ changed: boolean; persistTeams: boolean }> {
  if (state.guestStep !== "game_bingo") {
    return { changed: false, persistTeams: false };
  }
  if (state.bingoRoundEndsAtEpochMs == null) {
    return { changed: false, persistTeams: false };
  }
  if (nowMs < state.bingoRoundEndsAtEpochMs) {
    return { changed: false, persistTeams: false };
  }

  const from = state.guestStep;
  const to = "leaderboard_post_bingo" as const;
  const transitionAtMs = state.bingoRoundEndsAtEpochMs ?? nowMs;
  await applyTransitionSideEffects(state, from, to, transitionAtMs);
  state.guestStep = to;
  state.bingoRoundEndsAtEpochMs = null;
  state.revision += 1;
  return { changed: true, persistTeams: false };
}

/**
 * Advances trivia / quotes MCQ rounds on a fixed server timeline.
 * Returns true if state was changed.
 */
async function applyDueTeamMcqRoundAdvance(state: SessionState, nowMs: number): Promise<boolean> {
  const step = state.guestStep;
  if (step !== "game_trivia" && step !== "game_quotes") {
    return false;
  }

  if (state.teamMcqRoundStartedAtEpochMs == null) {
    state.teamMcqRoundStartedAtEpochMs = nowMs;
    state.teamMcqRoundIndex = 0;
    state.revision += 1;
    return true;
  }

  const total =
    step === "game_trivia"
      ? TRIVIA_QUESTIONS.length
      : getQuoteQuestions().length;

  let changed = false;
  while (
    state.teamMcqRoundIndex < total - 1 &&
    nowMs >= state.teamMcqRoundStartedAtEpochMs + TEAM_MCQ_CYCLE_MS
  ) {
    state.teamMcqRoundIndex += 1;
    state.teamMcqRoundStartedAtEpochMs += TEAM_MCQ_CYCLE_MS;
    changed = true;
  }

  if (changed) {
    state.revision += 1;
    return true;
  }
  return false;
}

/** Handles all periodic state transitions in one pass. */
async function applyPreconditions(existingState?: SessionState, nowMs: number = Date.now()): Promise<SessionState> {
  const state = existingState || await getStoreState();
  const r1 = await applyDueScheduledTransitions(state, nowMs);
  const c2 = await applyDueTeamMcqRoundAdvance(state, nowMs);
  const r3 = await applyDueBingoRoundEnd(state, nowMs);

  if (r1.changed || c2 || r3.changed) {
    await commitState(state, {
      persistTeams: r1.persistTeams || r3.persistTeams,
    });
    notifySessionChanged();
  }
  return state;
}

function activeTeamMcqQuestionId(state: SessionState): string | null {
  const step = state.guestStep;
  if (step !== "game_trivia" && step !== "game_quotes") return null;
  const idx = state.teamMcqRoundIndex;
  if (step === "game_trivia") {
    return TRIVIA_QUESTIONS[idx]?.id ?? null;
  }
  return getQuoteQuestions()[idx]?.id ?? null;
}

function lobbyTeamsFromSession(state: SessionState): LobbyTeamRoster[] {
  return state.teams.map((t) => ({
    name: t.name,
    nicknames: t.playerIds.map(
      (id) => state.players.find((p) => p.id === id)?.nickname ?? "?"
    ),
  }));
}

/** @returns Whether trivia/quotes team rosters were rebuilt (DB sync required). */
async function applyTransitionSideEffects(
  state: SessionState,
  from: GuestStep,
  to: GuestStep,
  nowMs: number = Date.now(),
): Promise<boolean> {
  let teamsRebuilt = false;

  if (from === "game_bingo" && to !== "game_bingo") {
    state.bingoRoundEndsAtEpochMs = null;
    state.bingoSongOrder = [];
    state.bingoCurrentSongIndex = 0;
    state.bingoMarkedByPlayer = {};
  }

  if (to === "lobby_trivia" || to === "lobby_bingo" || to === "lobby_quotes") {
    state.scheduledGameStartsAtEpochMs = null;
  }

  if (to === "lobby_trivia" || to === "lobby_quotes") {
    await internalRebuildTeams(state);
    teamsRebuilt = true;
  }

  if (to === "game_trivia") {
    state.triviaVotesByPlayer = {};
    state.teamMcqRoundIndex = 0;
    state.teamMcqRoundStartedAtEpochMs = null;
  }

  if (to === "game_quotes") {
    state.quoteVotesByPlayer = {};
    state.teamMcqRoundIndex = 0;
    state.teamMcqRoundStartedAtEpochMs = nowMs;
  }

  if (to === "game_bingo") {
    state.bingoClaimedLineKeysByPlayer = {};
    state.bingoMarkedByPlayer = {};
    state.gameScores[BINGO_GAME_ID] = {};
    const order = [...BINGO_SONG_TITLES];
    shuffle(order);
    state.bingoSongOrder = order;
    state.bingoCurrentSongIndex = 0;
    state.bingoRoundEndsAtEpochMs = nowMs + BINGO_ROUND_DURATION_MS;
  }

  if (to === "leaderboard_post_trivia") {
    recordRoundScoresForCompletedGame(state, 0);
  }
  if (to === "leaderboard_post_bingo") {
    recordRoundScoresForCompletedGame(state, 1);
  }
  if (to === "leaderboard_final") {
    recordRoundScoresForCompletedGame(state, 2);
  }

  return teamsRebuilt;
}

function recordRoundScoresForCompletedGame(state: SessionState, gameSlotIndex: number): void {
  const game = GAMES[gameSlotIndex];
  if (!game) return;
  const scores: Record<string, number> = {};
  if (game.type === "individual") {
    if (game.id === BINGO_GAME_ID) {
      const prior = state.gameScores[BINGO_GAME_ID] ?? {};
      state.players.forEach((p) => {
        scores[p.id] = prior[p.id] ?? 0;
      });
    } else {
      // Mock scores for individual games other than bingo
      const byId = [...state.players].sort((a, b) => a.id.localeCompare(b.id));
      byId.forEach((p, i) => {
        scores[p.id] = 400 - i * 25;
      });
    }
  } else if (game.id === TRIVIA_GAME_ID) {
    const computed = computeTriviaScoresFromVotes(
      state.players.map((p) => p.id),
      state.teams,
      state.triviaVotesByPlayer,
      TRIVIA_QUESTIONS.map((q) => ({ id: q.id, correctIndex: q.correctIndex }))
    );
    state.players.forEach((p) => { scores[p.id] = computed[p.id] ?? 0; });
  } else if (game.id === QUOTES_GAME_ID) {
    const questions = getQuoteQuestions();
    const computed = computeTriviaScoresFromVotes(
      state.players.map((p) => p.id),
      state.teams,
      state.quoteVotesByPlayer,
      questions.map((q) => ({ id: q.id, correctIndex: q.correctIndex }))
    );
    state.players.forEach((p) => { scores[p.id] = computed[p.id] ?? 0; });
  } else {
    // Team games default scoring
    const teams = [...state.teams].sort((a, b) => a.id.localeCompare(b.id));
    teams.forEach((t, ti) => {
      const teamPts = 300 + ti * 75 + t.playerIds.length * 10;
      t.playerIds.forEach((pid) => { scores[pid] = teamPts; });
    });
  }
  state.gameScores[game.id] = scores;
}

function normalizedBingoMarks(m: boolean[] | undefined): boolean[] {
  if (m?.length !== BINGO_CELL_COUNT) {
    return Array.from({ length: BINGO_CELL_COUNT }, () => false);
  }
  return [...m];
}

function bingoLineFullyMarkedOnServer(state: SessionState, playerId: string, lineKey: string): boolean {
  const idx = bingoIndicesForLineKey(lineKey);
  if (!idx) return false;
  const marks = normalizedBingoMarks(state.bingoMarkedByPlayer[playerId]);
  return idx.every((i) => marks[i]);
}

function bingoFullCardMarkedOnServer(state: SessionState, playerId: string): boolean {
  const marks = normalizedBingoMarks(state.bingoMarkedByPlayer[playerId]);
  return marks.every(Boolean);
}

function currentBingoSongTitle(state: SessionState): string | null {
  const order = state.bingoSongOrder;
  if (!order.length) return null;
  const i = Math.min(Math.max(0, state.bingoCurrentSongIndex), order.length - 1);
  return order[i] ?? null;
}

export function buildTeamLeaderboardEntries(
  teams: Team[],
  scores: Record<string, number>
): { name: string; score: number }[] {
  return sortLeaderboardEntries(
    teams.map((t) => {
      const teamScore = t.playerIds.reduce(
        (acc, pid) => acc + (scores[pid] ?? 0),
        0
      );
      return {
        name: t.name,
        score: teamScore,
      };
    })
  );
}

function getLeaderboardForGameSlot(state: SessionState, slot: number): { name: string; score: number }[] {
  const game = GAMES[slot] ?? null;
  if (!game) return [];
  const scores = state.gameScores[game.id];
  if (!scores) return [];
  if (game.type === "individual") {
    return sortLeaderboardEntries(
      state.players.map((p) => ({ name: p.nickname, score: scores[p.id] ?? 0 }))
    );
  }
  return buildTeamLeaderboardEntries(state.teams, scores);
}

function getFinalLeaderboard(state: SessionState): { nickname: string; totalScore: number }[] {
  const totals: Record<string, number> = {};
  state.players.forEach((p) => { totals[p.id] = 0; });
  GAMES.forEach((game) => {
    const scores = state.gameScores[game.id];
    if (!scores) return;
    state.players.forEach((p) => { totals[p.id] += scores[p.id] ?? 0; });
  });
  return sortLeaderboardEntries(
    state.players.map((p) => ({
      name: p.nickname,
      score: totals[p.id] ?? 0,
    }))
  ).map((e) => ({ nickname: e.name, totalScore: e.score }));
}

export type BingoClaimResult = {
  awarded: number;
  totalForPlayer: number;
  claimedLineKeys: string[];
};

export async function claimBingo(playerId: string, lineKeys: string[]): Promise<BingoClaimResult | null> {
  const state = await applyPreconditions();
  if (state.guestStep !== "game_bingo") return null;
  if (!state.players.some((p) => p.id === playerId)) return null;

  const unique = [...new Set(lineKeys)];
  const priorClaimed = state.bingoClaimedLineKeysByPlayer[playerId] ?? [];
  const validNewLines = unique.filter((k) => {
    const isWin = BINGO_VALID_LINE_KEYS.has(k);
    const notClaimed = !priorClaimed.includes(k);
    const fullyMarked = bingoLineFullyMarkedOnServer(state, playerId, k);
    return isWin && notClaimed && fullyMarked;
  });
  const fullNew = unique.includes(BINGO_FULL_CARD_CLAIM_KEY) && !priorClaimed.includes(BINGO_FULL_CARD_CLAIM_KEY) && bingoFullCardMarkedOnServer(state, playerId);

  if (validNewLines.length === 0 && !fullNew) {
    const cur = state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0;
    return { awarded: 0, totalForPlayer: cur, claimedLineKeys: [...priorClaimed] };
  }

  const prev = state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0;
  const lineDelta = validNewLines.reduce((sum, k) => sum + bingoPointsForValidLineKey(k), 0);
  const delta = lineDelta + (fullNew ? BINGO_POINTS_FULL_CARD : 0);

  if (!state.gameScores[BINGO_GAME_ID]) state.gameScores[BINGO_GAME_ID] = {};
  state.gameScores[BINGO_GAME_ID][playerId] = prev + delta;
  state.bingoClaimedLineKeysByPlayer[playerId] = [...priorClaimed, ...validNewLines, ...(fullNew ? [BINGO_FULL_CARD_CLAIM_KEY] : [])];
  state.revision += 1;
  await commitState(state);
  notifySessionChanged();

  const finalScore = state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0;
  const finalClaims = state.bingoClaimedLineKeysByPlayer[playerId] ?? [];
  return {
    awarded: delta,
    totalForPlayer: finalScore,
    claimedLineKeys: finalClaims,
  };
}

export type BingoMarkResult =
  | { ok: true; marked: boolean[]; score: number; wrongTapPenalty: boolean }
  | { ok: false; error: "not_active" | "unknown_player" | "bad_cell" | "no_song" };

export async function markBingoCell(playerId: string, cellIndex: number, mark: boolean): Promise<BingoMarkResult> {
  const state = await applyPreconditions();
  if (state.guestStep !== "game_bingo") return { ok: false, error: "not_active" };
  if (!state.players.some((p) => p.id === playerId)) return { ok: false, error: "unknown_player" };
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= BINGO_CELL_COUNT) return { ok: false, error: "bad_cell" };

  const marks = normalizedBingoMarks(state.bingoMarkedByPlayer[playerId]);
  if (!mark) {
    marks[cellIndex] = false;
    state.bingoMarkedByPlayer[playerId] = marks;
    state.revision += 1;
    await commitState(state);
    notifySessionChanged();
    const score = state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0;
    return { ok: true, marked: marks, score, wrongTapPenalty: false };
  }

  if (marks[cellIndex]) {
    const score = state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0;
    return { ok: true, marked: marks, score, wrongTapPenalty: false };
  }

  const current = currentBingoSongTitle(state);
  if (!current) return { ok: false, error: "no_song" };

  const cellTitle = bingoCardTitlesForPlayer(playerId)[cellIndex];
  if (cellTitle !== current) {
    const scoresObj = state.gameScores[BINGO_GAME_ID] || {};
    const prev = scoresObj[playerId] ?? 0;
    state.gameScores[BINGO_GAME_ID] = { ...scoresObj, [playerId]: prev - BINGO_WRONG_TAP_PENALTY };
    state.revision += 1;
    await commitState(state);
    notifySessionChanged();
    const score = state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0;
    return { ok: true, marked: marks, score, wrongTapPenalty: true };
  }

  marks[cellIndex] = true;
  state.bingoMarkedByPlayer[playerId] = marks;
  state.revision += 1;
  await commitState(state);
  notifySessionChanged();
  const score = state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0;
  return { ok: true, marked: marks, score, wrongTapPenalty: false };
}

export type AdminBingoAdvanceResult = | { ok: true } | { ok: false; error: "not_active" | "at_end" };

export async function adminAdvanceBingoSong(): Promise<AdminBingoAdvanceResult> {
  await applyPreconditions();
  const state = await getStoreState();
  if (state.guestStep !== "game_bingo") return { ok: false, error: "not_active" };
  const max = state.bingoSongOrder.length - 1;
  if (state.bingoCurrentSongIndex >= max) return { ok: false, error: "at_end" };
  state.bingoCurrentSongIndex += 1;
  state.revision += 1;
  await commitState(state);
  notifySessionChanged();
  return { ok: true };
}


export type TriviaVoteResult = | { ok: true } | { ok: false; error: "not_active" | "unknown_player" | "bad_question" | "bad_option" | "wrong_question" };

export async function submitTriviaVote(playerId: string, questionId: string, optionIndex: number): Promise<TriviaVoteResult> {
  await applyPreconditions();
  const state = await getStoreState();
  if (state.guestStep !== "game_trivia") return { ok: false, error: "not_active" };
  if (!state.players.some((p) => p.id === playerId)) return { ok: false, error: "unknown_player" };
  if (!TRIVIA_QUESTION_IDS.has(questionId)) return { ok: false, error: "bad_question" };
  if (!isValidTriviaOptionIndex(optionIndex)) return { ok: false, error: "bad_option" };
  const activeQuestionId = activeTeamMcqQuestionId(state);
  if (activeQuestionId !== questionId) return { ok: false, error: "wrong_question" };

  const prev = state.triviaVotesByPlayer[playerId] ?? {};
  state.triviaVotesByPlayer[playerId] = { ...prev, [questionId]: optionIndex };
  state.revision += 1;
  await commitState(state);
  notifySessionChanged();
  return { ok: true };
}

export type QuoteVoteResult = | { ok: true } | { ok: false; error: "not_active" | "unknown_player" | "bad_question" | "bad_option" | "wrong_question" };

export async function submitQuoteVote(playerId: string, questionId: string, optionIndex: number): Promise<QuoteVoteResult> {
  await applyPreconditions();
  const state = await getStoreState();
  if (state.guestStep !== "game_quotes") return { ok: false, error: "not_active" };
  if (!state.players.some((p) => p.id === playerId)) return { ok: false, error: "unknown_player" };
  if (!quoteQuestionIds().has(questionId)) return { ok: false, error: "bad_question" };
  if (!isValidTriviaOptionIndex(optionIndex)) return { ok: false, error: "bad_option" };
  const activeQuestionId = activeTeamMcqQuestionId(state);
  if (activeQuestionId !== questionId) return { ok: false, error: "wrong_question" };

  const prev = state.quoteVotesByPlayer[playerId] ?? {};
  state.quoteVotesByPlayer[playerId] = { ...prev, [questionId]: optionIndex };
  state.revision += 1;
  await commitState(state);
  notifySessionChanged();
  return { ok: true };
}

export async function registerPlayer(nickname: string): Promise<string> {
  const id = generateId();
  const state = await getStoreState();

  // Robustness: Handle late joins by assigning to the smallest team for the ACTIVE game context
  let teamId = null;
  const game = gameSlotFromGuestStep(state.guestStep);
  if (game !== null && state.teams.length > 0) {
    const teamsWithCounts = state.teams.map((t) => ({
      id: t.id,
      count: t.playerIds.length,
    }));
    teamsWithCounts.sort((a, b) => a.count - b.count);
    teamId = teamsWithCounts[0]?.id || null;
  }

  // Persist to database (Relational mapping)
  await supabase.from("players").insert({ id, nickname });

  if (teamId) {
    await supabase.from("team_membership").insert({ team_id: teamId, player_id: id });
  }

  notifySessionChanged();

  return id;
}

export async function getSessionState(nowMs?: number): Promise<SessionState> {
  const state = await applyPreconditions(undefined, nowMs);
  return { ...state, players: [...state.players], teams: [...state.teams] };
}

function currentGameForPublic(state: SessionState): (typeof GAMES)[number] | null {
  const slot = gameSlotFromGuestStep(state.guestStep);
  if (slot === null) return null;
  return GAMES[slot] ?? null;
}

function shouldShowMyTeam(state: SessionState, game: (typeof GAMES)[number] | null): boolean {
  const step = state.guestStep;
  return (game?.type === "team") && (step === "lobby_trivia" || step === "lobby_quotes" || step === "game_trivia" || step === "leaderboard_post_trivia" || step === "game_quotes");
}

export async function getPublicState(playerId: string | null, nowMs?: number): Promise<PublicState> {
  const state = await applyPreconditions(undefined, nowMs);
  const game = currentGameForPublic(state);

  const myTeam = getMyTeamInfo(state, playerId, game);
  const myTeammateNicknames = getMyTeammateNicknames(state, playerId, myTeam);

  const slot = gameSlotFromGuestStep(state.guestStep);
  const step = state.guestStep;

  return {
    guestStep: step,
    revision: state.revision,
    scheduledGameStartsAtEpochMs: state.scheduledGameStartsAtEpochMs,
    playerCount: state.players.length,
    players: state.players,
    teams: state.teams,
    currentGame: game,
    currentGameIndex: publicGameIndexFromGuestStep(step),
    myTeam,
    myTeammateNicknames,
    leaderboard: isLeaderboardStep(step) ? getLeaderboardForGameSlot(state, slot ?? 0) : [],
    finalLeaderboard: step === "leaderboard_final" ? getFinalLeaderboard(state) : [],
    lobbyTeams: isLobbyStep(step) ? lobbyTeamsFromSession(state) : [],
    gameScores: state.gameScores,
    myBingoClaimedLineKeys: (step === "game_bingo" && playerId) ? [...(state.bingoClaimedLineKeysByPlayer[playerId] ?? [])] : [],
    myBingoScore: (step === "game_bingo" && playerId) ? state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0 : 0,
    bingoRoundEndsAtEpochMs: step === "game_bingo" ? state.bingoRoundEndsAtEpochMs : null,
    myBingoMarkedCells: (step === "game_bingo" && playerId) ? normalizedBingoMarks(state.bingoMarkedByPlayer[playerId]) : [],
    myTriviaVotes: (step === "game_trivia" && playerId) ? { ...state.triviaVotesByPlayer[playerId] } : {},
    myQuoteVotes: (step === "game_quotes" && playerId) ? { ...state.quoteVotesByPlayer[playerId] } : {},
    teamMcqSync: getTeamMcqSyncInfo(state),
    playerKnownToSession: playerId == null || state.players.some((p) => p.id === playerId),
    games: state.games,
    syncRevision: state.revision,
  };
}

function getMyTeamInfo(state: SessionState, playerId: string | null, game: GameConfig | null): Team | null {
  if (playerId && state.teams.length > 0 && game && shouldShowMyTeam(state, game)) {
    return state.teams.find((t) => t.playerIds.includes(playerId)) ?? null;
  }
  return null;
}

function getMyTeammateNicknames(state: SessionState, playerId: string | null, myTeam: Team | null): string[] {
  if (myTeam && playerId) {
    return myTeam.playerIds.filter((id) => id !== playerId).map((id) => state.players.find((p) => p.id === id)?.nickname ?? "?");
  }
  return [];
}

function getTeamMcqSyncInfo(state: SessionState) {
  const isMcq = state.guestStep === "game_trivia" || state.guestStep === "game_quotes";
  if (!isMcq) return null;

  return {
    questionIndex: state.teamMcqRoundIndex,
    roundStartedAtEpochMs: state.teamMcqRoundStartedAtEpochMs!,
    totalQuestions: state.guestStep === "game_trivia" ? TRIVIA_QUESTIONS.length : getQuoteQuestions().length,
    answerMs: TEAM_MCQ_ANSWER_MS,
    revealMs: TEAM_MCQ_REVEAL_MS,
  };
}

function isLeaderboardStep(step: GuestStep) {
  return step === "leaderboard_post_trivia" || step === "leaderboard_post_bingo";
}

function isLobbyStep(step: GuestStep) {
  return step === "lobby_trivia" || step === "lobby_quotes";
}

export async function advancePhase(nowMs: number = Date.now()): Promise<void> {
  const initialState = await getStoreState();
  const startStep = initialState.guestStep;
  const state = await applyPreconditions(initialState, nowMs);
  const from = state.guestStep;
  if (from !== startStep) return;

  if (LOBBY_STEPS_WITH_SCHEDULE.has(from) && state.scheduledGameStartsAtEpochMs != null) return;

  if (LOBBY_STEPS_WITH_SCHEDULE.has(from) && state.scheduledGameStartsAtEpochMs == null) {
    const now = nowMs ?? Date.now();
    state.scheduledGameStartsAtEpochMs = now + LOBBY_PRE_GAME_LEAD_MS;
    state.revision += 1;
    await commitState(state);
    notifySessionChanged();
    return;
  }

  const to = getNextGuestStep(from);
  if (!to) return;
  const teamsRebuilt = await applyTransitionSideEffects(state, from, to, nowMs);
  state.guestStep = to;
  state.scheduledGameStartsAtEpochMs = null;
  state.revision += 1;
  await commitState(state, { persistTeams: teamsRebuilt });
  notifySessionChanged();
}

export async function resetSession(): Promise<void> {
  // 1. Reset Session table (Explicit columns)
  await supabase
    .from("session")
    .update({
      guest_step: "party_protocol",
      revision: 0,
      scheduled_start_ms: null,
      mcq_round_index: 0,
      mcq_round_start_ms: null,
      bingo_song_order: [],
      bingo_current_index: 0,
      bingo_round_end_ms: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  // 2. Clear all other relational tables
  await supabase.from("players").delete().neq("id", "0");
  await supabase.from("teams").delete().neq("id", "0");
  await supabase.from("team_membership").delete().neq("team_id", "0");
  await supabase.from("game_scores").delete().neq("game_id", "0");
  await supabase.from("votes").delete().neq("game_id", "0");
  await supabase.from("bingo_marks").delete().neq("player_id", "0");
  await supabase.from("bingo_claims").delete().neq("player_id", "0");

  notifySessionChanged();
}

/** FOR TESTING ONLY: Manually sets the bingo playback order and current index. */
export async function setBingoPlaybackForTests(order: string[], index: number): Promise<void> {
  const state = await getStoreState();
  state.bingoSongOrder = order;
  state.bingoCurrentSongIndex = index;
  await commitState(state);
}
