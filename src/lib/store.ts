import type {
  GuestStep,
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

const TRIVIA_QUESTION_IDS = new Set(TRIVIA_QUESTIONS.map((q) => q.id));

function quoteQuestionIds(): Set<string> {
  return new Set(getQuoteQuestions().map((q) => q.id));
}

const INITIAL_STATE: Omit<
  SessionState,
  | "players"
  | "teams"
  | "gameScores"
  | "bingoClaimedLineKeysByPlayer"
  | "bingoMarkedByPlayer"
  | "triviaVotesByPlayer"
  | "quoteVotesByPlayer"
> = {
  guestStep: "party_protocol",
  revision: 0,
  countdownRemaining: null,
  scheduledGameStartsAtEpochMs: null,
  teamMcqRoundIndex: 0,
  teamMcqRoundStartedAtEpochMs: null,
  games: GAMES,
  bingoSongOrder: [],
  bingoCurrentSongIndex: 0,
  bingoRoundEndsAtEpochMs: null,
};

const LOBBY_STEPS_WITH_SCHEDULE: readonly GuestStep[] = [
  "lobby_trivia",
  "lobby_bingo",
  "lobby_quotes",
];

/** 
 * Fetches the shared session state from Supabase.
 * In a production Vercel environment, this ensures all Lambda instances stay in sync.
 */
async function getStoreState(): Promise<SessionState> {
  const { data, error } = await supabase
    .from("session_store")
    .select("data")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return {
      ...INITIAL_STATE,
      games: [...GAMES],
      players: [],
      teams: [],
      gameScores: {},
      bingoClaimedLineKeysByPlayer: {},
      bingoMarkedByPlayer: {},
      triviaVotesByPlayer: {},
      quoteVotesByPlayer: {},
      teamMcqRoundIndex: 0,
      teamMcqRoundStartedAtEpochMs: null,
    };
  }

  const s = data.data as SessionState;
  
  // Ensure non-null objects for maps/sets
  if (!s.triviaVotesByPlayer) s.triviaVotesByPlayer = {};
  if (!s.quoteVotesByPlayer) s.quoteVotesByPlayer = {};
  if (!s.bingoMarkedByPlayer) s.bingoMarkedByPlayer = {};
  if (!s.bingoSongOrder) s.bingoSongOrder = [];
  if (s.bingoCurrentSongIndex === undefined) s.bingoCurrentSongIndex = 0;
  
  return s;
}

/** Persists the modified state back to the shared Supabase table. */
async function commitState(state: SessionState): Promise<void> {
  await supabase
    .from("session_store")
    .upsert({ id: 1, data: state, last_revision: state.revision });
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
  await commitState(state);
  notifySessionChanged();
}

/** 
 * Checks and apply any due step advances (lobby -> game) based on scheduled timestamps.
 * Returns the potentially updated state.
 */
export async function applyDueScheduledTransitions(
  nowMs: number = Date.now(),
): Promise<void> {
  const state = await getStoreState();
  if (state.scheduledGameStartsAtEpochMs == null) return;
  if (!LOBBY_STEPS_WITH_SCHEDULE.includes(state.guestStep)) return;
  if (nowMs < state.scheduledGameStartsAtEpochMs) return;

  const from = state.guestStep;
  const to: GuestStep =
    from === "lobby_trivia"
      ? "game_trivia"
      : from === "lobby_bingo"
        ? "game_bingo"
        : "game_quotes";

  await applyTransitionSideEffects(state, from, to);
  state.guestStep = to;
  state.scheduledGameStartsAtEpochMs = null;
  state.countdownRemaining = null;
  state.revision += 1;
  await commitState(state);
  notifySessionChanged();
}

/** 
 * Checks and apply any due bingo round ends.
 */
export async function applyDueBingoRoundEnd(nowMs: number = Date.now()): Promise<void> {
  const state = await getStoreState();
  if (state.guestStep !== "game_bingo") return;
  if (state.bingoRoundEndsAtEpochMs == null) return;
  if (nowMs < state.bingoRoundEndsAtEpochMs) return;

  const from = state.guestStep;
  const to = "leaderboard_post_bingo" as const;
  await applyTransitionSideEffects(state, from, to);
  state.guestStep = to;
  state.bingoRoundEndsAtEpochMs = null;
  state.revision += 1;
  await commitState(state);
  notifySessionChanged();
}

/**
 * Advances trivia / quotes MCQ rounds on a fixed server timeline.
 */
export async function applyDueTeamMcqRoundAdvance(nowMs: number = Date.now()): Promise<void> {
  const state = await getStoreState();
  const step = state.guestStep;
  if (step !== "game_trivia" && step !== "game_quotes") {
    return;
  }
  
  if (state.teamMcqRoundStartedAtEpochMs == null) {
    state.teamMcqRoundStartedAtEpochMs = nowMs;
    state.teamMcqRoundIndex = 0;
    state.revision += 1;
    await commitState(state);
    notifySessionChanged();
    return;
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
    await commitState(state);
    notifySessionChanged();
  }
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

async function applyTransitionSideEffects(state: SessionState, from: GuestStep, to: GuestStep): Promise<void> {
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
  }

  if (to === "game_trivia" || to === "game_bingo" || to === "game_quotes") {
    state.countdownRemaining = null;
  }

  if (to === "game_trivia") {
    state.triviaVotesByPlayer = {};
    state.teamMcqRoundIndex = 0;
    state.teamMcqRoundStartedAtEpochMs = Date.now();
  }

  if (to === "game_quotes") {
    state.quoteVotesByPlayer = {};
    state.teamMcqRoundIndex = 0;
    state.teamMcqRoundStartedAtEpochMs = Date.now();
  }

  if (to === "game_bingo") {
    state.bingoClaimedLineKeysByPlayer = {};
    state.bingoMarkedByPlayer = {};
    state.gameScores[BINGO_GAME_ID] = {};
    const order = [...BINGO_SONG_TITLES];
    shuffle(order);
    state.bingoSongOrder = order;
    state.bingoCurrentSongIndex = 0;
    state.bingoRoundEndsAtEpochMs = Date.now() + BINGO_ROUND_DURATION_MS;
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
  if (!m || m.length !== BINGO_CELL_COUNT) {
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

function getLeaderboardForGameSlot(state: SessionState, slot: number): { name: string; score: number }[] {
  const game = GAMES[slot] ?? null;
  if (!game || !state.gameScores[game.id]) return [];
  const scores = state.gameScores[game.id]!;
  if (game.type === "individual") {
    return sortLeaderboardEntries(
      state.players.map((p) => ({ name: p.nickname, score: scores[p.id] ?? 0 }))
    );
  }
  return sortLeaderboardEntries(
    state.teams.map((t) => ({
      name: t.name,
      score: t.playerIds.length ? (scores[t.playerIds[0]!] ?? 0) : 0,
    }))
  );
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
  await applyDueScheduledTransitions();
  await applyDueTeamMcqRoundAdvance();
  await applyDueBingoRoundEnd();
  const state = await getStoreState();
  if (state.guestStep !== "game_bingo") return null;
  if (!state.players.some((p) => p.id === playerId)) return null;

  const unique = [...new Set(lineKeys)];
  const priorClaimed = state.bingoClaimedLineKeysByPlayer[playerId] ?? [];
  const validNewLines = unique.filter(
    (k) => BINGO_VALID_LINE_KEYS.has(k) && !priorClaimed.includes(k) && bingoLineFullyMarkedOnServer(state, playerId, k)
  );
  const fullNew = unique.includes(BINGO_FULL_CARD_CLAIM_KEY) && !priorClaimed.includes(BINGO_FULL_CARD_CLAIM_KEY) && bingoFullCardMarkedOnServer(state, playerId);

  if (validNewLines.length === 0 && !fullNew) {
    const cur = state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0;
    return { awarded: 0, totalForPlayer: cur, claimedLineKeys: [...priorClaimed] };
  }

  if (!state.gameScores[BINGO_GAME_ID]) state.gameScores[BINGO_GAME_ID] = {};
  const prev = state.gameScores[BINGO_GAME_ID]![playerId] ?? 0;
  const lineDelta = validNewLines.reduce((sum, k) => sum + bingoPointsForValidLineKey(k), 0);
  const delta = lineDelta + (fullNew ? BINGO_POINTS_FULL_CARD : 0);
  
  state.gameScores[BINGO_GAME_ID]![playerId] = prev + delta;
  state.bingoClaimedLineKeysByPlayer[playerId] = [...priorClaimed, ...validNewLines, ...(fullNew ? [BINGO_FULL_CARD_CLAIM_KEY] : [])];
  state.revision += 1;
  await commitState(state);
  notifySessionChanged();
  
  return {
    awarded: delta,
    totalForPlayer: state.gameScores[BINGO_GAME_ID]![playerId]!,
    claimedLineKeys: state.bingoClaimedLineKeysByPlayer[playerId]!,
  };
}

export type BingoMarkResult =
  | { ok: true; marked: boolean[]; score: number; wrongTapPenalty: boolean }
  | { ok: false; error: "not_active" | "unknown_player" | "bad_cell" | "no_song" };

export async function markBingoCell(playerId: string, cellIndex: number, mark: boolean): Promise<BingoMarkResult> {
  await applyDueScheduledTransitions();
  await applyDueTeamMcqRoundAdvance();
  await applyDueBingoRoundEnd();
  const state = await getStoreState();
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
    if (!state.gameScores[BINGO_GAME_ID]) state.gameScores[BINGO_GAME_ID] = {};
    const prev = state.gameScores[BINGO_GAME_ID]![playerId] ?? 0;
    state.gameScores[BINGO_GAME_ID]![playerId] = prev - BINGO_WRONG_TAP_PENALTY;
    state.revision += 1;
    await commitState(state);
    notifySessionChanged();
    const score = state.gameScores[BINGO_GAME_ID]![playerId] ?? 0;
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
  await applyDueScheduledTransitions();
  await applyDueTeamMcqRoundAdvance();
  await applyDueBingoRoundEnd();
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
  await applyDueScheduledTransitions();
  await applyDueTeamMcqRoundAdvance();
  await applyDueBingoRoundEnd();
  const state = await getStoreState();
  if (state.guestStep !== "game_trivia") return { ok: false, error: "not_active" };
  if (!state.players.some((p) => p.id === playerId)) return { ok: false, error: "unknown_player" };
  if (!TRIVIA_QUESTION_IDS.has(questionId)) return { ok: false, error: "bad_question" };
  if (!isValidTriviaOptionIndex(optionIndex)) return { ok: false, error: "bad_option" };
  
  const activeId = activeTeamMcqQuestionId(state);
  if (questionId !== activeId) return { ok: false, error: "wrong_question" };
  
  const prev = state.triviaVotesByPlayer[playerId] ?? {};
  state.triviaVotesByPlayer[playerId] = { ...prev, [questionId]: optionIndex };
  state.revision += 1;
  await commitState(state);
  notifySessionChanged();
  return { ok: true };
}

export type QuoteVoteResult = | { ok: true } | { ok: false; error: "not_active" | "unknown_player" | "bad_question" | "bad_option" | "wrong_question" };

export async function submitQuoteVote(playerId: string, questionId: string, optionIndex: number): Promise<QuoteVoteResult> {
  await applyDueScheduledTransitions();
  await applyDueTeamMcqRoundAdvance();
  await applyDueBingoRoundEnd();
  const state = await getStoreState();
  if (state.guestStep !== "game_quotes") return { ok: false, error: "not_active" };
  if (!state.players.some((p) => p.id === playerId)) return { ok: false, error: "unknown_player" };
  if (!quoteQuestionIds().has(questionId)) return { ok: false, error: "bad_question" };
  if (!isValidTriviaOptionIndex(optionIndex)) return { ok: false, error: "bad_option" };
  
  const activeId = activeTeamMcqQuestionId(state);
  if (questionId !== activeId) return { ok: false, error: "wrong_question" };

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
  state.players.push({ id, nickname });
  await commitState(state);
  notifySessionChanged();
  return id;
}

export async function getSessionState(): Promise<SessionState> {
  await applyDueScheduledTransitions();
  await applyDueTeamMcqRoundAdvance();
  await applyDueBingoRoundEnd();
  const state = await getStoreState();
  return { ...state, players: [...state.players], teams: [...state.teams] };
}

function currentGameForPublic(state: SessionState): (typeof GAMES)[number] | null {
  const slot = gameSlotFromGuestStep(state.guestStep);
  if (slot === null) return null;
  return GAMES[slot] ?? null;
}

function shouldShowMyTeam(state: SessionState, game: (typeof GAMES)[number] | null): boolean {
  if (!game || game.type !== "team") return false;
  const step = state.guestStep;
  return (step === "lobby_trivia" || step === "lobby_quotes" || step === "game_trivia" || step === "leaderboard_post_trivia" || step === "game_quotes");
}

export async function getPublicState(playerId: string | null): Promise<PublicState> {
  await applyDueScheduledTransitions();
  await applyDueTeamMcqRoundAdvance();
  await applyDueBingoRoundEnd();
  const state = await getStoreState();
  const game = currentGameForPublic(state);
  let myTeam: Team | null = null;
  let myTeammateNicknames: string[] = [];
  if (playerId && state.teams.length > 0 && game && shouldShowMyTeam(state, game)) {
    myTeam = state.teams.find((t) => t.playerIds.includes(playerId)) ?? null;
    if (myTeam) {
      myTeammateNicknames = myTeam.playerIds.filter((id) => id !== playerId).map((id) => state.players.find((p) => p.id === id)?.nickname ?? "?");
    }
  }

  const slot = gameSlotFromGuestStep(state.guestStep);
  const leaderboard = (state.guestStep === "leaderboard_post_trivia" || state.guestStep === "leaderboard_post_bingo") ? getLeaderboardForGameSlot(state, slot ?? 0) : [];
  const finalLeaderboard = state.guestStep === "leaderboard_final" ? getFinalLeaderboard(state) : [];
  const currentGameIndex = publicGameIndexFromGuestStep(state.guestStep);
  const lobbyTeams = (state.guestStep === "lobby_trivia" || state.guestStep === "lobby_quotes") ? lobbyTeamsFromSession(state) : [];
  const myBingoClaimedLineKeys = (state.guestStep === "game_bingo" && playerId) ? [...(state.bingoClaimedLineKeysByPlayer[playerId] ?? [])] : [];
  const myBingoScore = (state.guestStep === "game_bingo" && playerId) ? state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0 : 0;
  const bingoRoundEndsAtEpochMs = state.guestStep === "game_bingo" ? state.bingoRoundEndsAtEpochMs : null;
  const myBingoMarkedCells = (state.guestStep === "game_bingo" && playerId) ? normalizedBingoMarks(state.bingoMarkedByPlayer[playerId]) : [];
  const myTriviaVotes = (state.guestStep === "game_trivia" && playerId) ? { ...(state.triviaVotesByPlayer[playerId] ?? {}) } : {};
  const myQuoteVotes = (state.guestStep === "game_quotes" && playerId) ? { ...(state.quoteVotesByPlayer[playerId] ?? {}) } : {};
  const playerKnownToSession = playerId == null || state.players.some((p) => p.id === playerId);

  return {
    guestStep: state.guestStep,
    revision: state.revision,
    scheduledGameStartsAtEpochMs: state.scheduledGameStartsAtEpochMs,
    countdownRemaining: state.countdownRemaining,
    playerCount: state.players.length,
    currentGame: game,
    currentGameIndex,
    myTeam,
    myTeammateNicknames,
    leaderboard,
    finalLeaderboard,
    lobbyTeams,
    myBingoClaimedLineKeys,
    myBingoScore,
    bingoRoundEndsAtEpochMs,
    myBingoMarkedCells,
    myTriviaVotes,
    myQuoteVotes,
    teamMcqSync:
      state.guestStep === "game_trivia" || state.guestStep === "game_quotes"
        ? {
            questionIndex: state.teamMcqRoundIndex,
            roundStartedAtEpochMs: state.teamMcqRoundStartedAtEpochMs!,
            totalQuestions:
              state.guestStep === "game_trivia"
                ? TRIVIA_QUESTIONS.length
                : getQuoteQuestions().length,
            answerMs: TEAM_MCQ_ANSWER_MS,
            revealMs: TEAM_MCQ_REVEAL_MS,
          }
        : null,
    playerKnownToSession,
    games: state.games,
    syncRevision: state.revision,
  };
}

export async function advancePhase(): Promise<void> {
  await applyDueScheduledTransitions();
  await applyDueTeamMcqRoundAdvance();
  await applyDueBingoRoundEnd();
  const state = await getStoreState();
  const from = state.guestStep;

  if (LOBBY_STEPS_WITH_SCHEDULE.includes(from) && state.scheduledGameStartsAtEpochMs != null) return;

  if (LOBBY_STEPS_WITH_SCHEDULE.includes(from) && state.scheduledGameStartsAtEpochMs == null) {
    state.scheduledGameStartsAtEpochMs = Date.now() + LOBBY_PRE_GAME_LEAD_MS;
    state.revision += 1;
    await commitState(state);
    notifySessionChanged();
    return;
  }

  const to = getNextGuestStep(from);
  if (!to) return;
  await applyTransitionSideEffects(state, from, to);
  state.guestStep = to;
  state.scheduledGameStartsAtEpochMs = null;
  state.revision += 1;
  await commitState(state);
  notifySessionChanged();
}

export async function resetSession(): Promise<void> {
  const nextState = {
    ...INITIAL_STATE,
    games: GAMES,
    players: [],
    teams: [],
    gameScores: {},
    bingoClaimedLineKeysByPlayer: {},
    bingoMarkedByPlayer: {},
    triviaVotesByPlayer: {},
    quoteVotesByPlayer: {},
    scheduledGameStartsAtEpochMs: null,
    teamMcqRoundIndex: 0,
    teamMcqRoundStartedAtEpochMs: null,
  };
  await commitState(nextState as SessionState);
  notifySessionChanged();
}

/** FOR TESTING ONLY: Manually sets the bingo playback order and current index. */
export async function setBingoPlaybackForTests(order: string[], index: number): Promise<void> {
  const state = await getStoreState();
  state.bingoSongOrder = order;
  state.bingoCurrentSongIndex = index;
  await commitState(state);
}
