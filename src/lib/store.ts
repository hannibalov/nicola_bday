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

const globalForStore = globalThis as unknown as { __nicola_store?: SessionState };

function getState(): SessionState {
  if (!globalForStore.__nicola_store) {
    globalForStore.__nicola_store = {
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
  const s = globalForStore.__nicola_store;
  if (!s.triviaVotesByPlayer) {
    s.triviaVotesByPlayer = {};
  }
  if (!s.quoteVotesByPlayer) {
    s.quoteVotesByPlayer = {};
  }
  if (!s.bingoMarkedByPlayer) {
    s.bingoMarkedByPlayer = {};
  }
  if (!s.bingoSongOrder) {
    s.bingoSongOrder = [];
  }
  if (s.bingoCurrentSongIndex === undefined) {
    s.bingoCurrentSongIndex = 0;
  }
  if (s.bingoRoundEndsAtEpochMs === undefined) {
    s.bingoRoundEndsAtEpochMs = null;
  }
  if (s.scheduledGameStartsAtEpochMs === undefined) {
    s.scheduledGameStartsAtEpochMs = null;
  }
  if (s.teamMcqRoundIndex === undefined) {
    s.teamMcqRoundIndex = 0;
  }
  if (s.teamMcqRoundStartedAtEpochMs === undefined) {
    s.teamMcqRoundStartedAtEpochMs = null;
  }
  return s;
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

export function rebuildTeams(): void {
  const state = getState();
  const ids = [...state.players].map((p) => p.id);
  shuffle(ids);
  state.teams = teamsFromShuffledPlayerIds(ids);
}

/**
 * Applies lobby → game transition when {@link SessionState.scheduledGameStartsAtEpochMs} is in the past.
 * Call from any read path so serverless requests advance the step without a background job.
 */
export function applyDueScheduledTransitions(nowMs: number = Date.now()): void {
  const state = getState();
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

  applyTransitionSideEffects(from, to);
  state.guestStep = to;
  state.scheduledGameStartsAtEpochMs = null;
  state.countdownRemaining = null;
  state.revision += 1;
  notifySessionChanged();
}

/**
 * Ends music bingo when the round timer expires; snapshot scores via {@link applyTransitionSideEffects}.
 */
export function applyDueBingoRoundEnd(nowMs: number = Date.now()): void {
  const state = getState();
  if (state.guestStep !== "game_bingo") return;
  if (state.bingoRoundEndsAtEpochMs == null) return;
  if (nowMs < state.bingoRoundEndsAtEpochMs) return;

  const from = state.guestStep;
  const to = "leaderboard_post_bingo" as const;
  applyTransitionSideEffects(from, to);
  state.guestStep = to;
  state.bingoRoundEndsAtEpochMs = null;
  state.revision += 1;
  notifySessionChanged();
}

/**
 * Advances trivia / quotes MCQ rounds on a fixed server timeline so all clients stay aligned.
 * Call from any read path (same pattern as {@link applyDueScheduledTransitions}).
 */
export function applyDueTeamMcqRoundAdvance(nowMs: number = Date.now()): void {
  const state = getState();
  const step = state.guestStep;
  if (step !== "game_trivia" && step !== "game_quotes") {
    return;
  }
  if (state.teamMcqRoundStartedAtEpochMs == null) {
    state.teamMcqRoundStartedAtEpochMs = nowMs;
    state.teamMcqRoundIndex = 0;
    state.revision += 1;
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

function applyTransitionSideEffects(from: GuestStep, to: GuestStep): void {
  const state = getState();

  if (from === "game_bingo" && to !== "game_bingo") {
    state.bingoRoundEndsAtEpochMs = null;
    state.bingoSongOrder = [];
    state.bingoCurrentSongIndex = 0;
    state.bingoMarkedByPlayer = {};
  }

  if (to === "lobby_trivia" || to === "lobby_bingo" || to === "lobby_quotes") {
    state.scheduledGameStartsAtEpochMs = null;
  }

  if (to === "lobby_trivia") {
    rebuildTeams();
  }

  if (to === "lobby_quotes") {
    rebuildTeams();
  }

  if (
    to === "game_trivia" ||
    to === "game_bingo" ||
    to === "game_quotes"
  ) {
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
    recordRoundScoresForCompletedGame(0);
  }
  if (to === "leaderboard_post_bingo") {
    recordRoundScoresForCompletedGame(1);
  }
  if (to === "leaderboard_final") {
    recordRoundScoresForCompletedGame(2);
  }
}

/**
 * Persists per-player scores for the round that just ended.
 * Deterministic placeholder until trivia/bingo/quote flows commit real points.
 * Team games: one score per team, copied to every member (product spec).
 */
function recordRoundScoresForCompletedGame(gameSlotIndex: number): void {
  const state = getState();
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
    state.players.forEach((p) => {
      scores[p.id] = computed[p.id] ?? 0;
    });
  } else if (game.id === QUOTES_GAME_ID) {
    const questions = getQuoteQuestions();
    const computed = computeTriviaScoresFromVotes(
      state.players.map((p) => p.id),
      state.teams,
      state.quoteVotesByPlayer,
      questions.map((q) => ({ id: q.id, correctIndex: q.correctIndex }))
    );
    state.players.forEach((p) => {
      scores[p.id] = computed[p.id] ?? 0;
    });
  } else {
    const teams = [...state.teams].sort((a, b) => a.id.localeCompare(b.id));
    teams.forEach((t, ti) => {
      const teamPts = 300 + ti * 75 + teamPlayerCount(t) * 10;
      t.playerIds.forEach((pid) => {
        scores[pid] = teamPts;
      });
    });
  }
  state.gameScores[game.id] = scores;
}

function teamPlayerCount(t: Team): number {
  return t.playerIds.length;
}

function normalizedBingoMarks(m: boolean[] | undefined): boolean[] {
  if (!m || m.length !== BINGO_CELL_COUNT) {
    return Array.from({ length: BINGO_CELL_COUNT }, () => false);
  }
  return [...m];
}

function bingoLineFullyMarkedOnServer(
  state: SessionState,
  playerId: string,
  lineKey: string
): boolean {
  const idx = bingoIndicesForLineKey(lineKey);
  if (!idx) return false;
  const marks = normalizedBingoMarks(state.bingoMarkedByPlayer[playerId]);
  return idx.every((i) => marks[i]);
}

function bingoFullCardMarkedOnServer(
  state: SessionState,
  playerId: string
): boolean {
  const marks = normalizedBingoMarks(state.bingoMarkedByPlayer[playerId]);
  return marks.every(Boolean);
}

function currentBingoSongTitle(state: SessionState): string | null {
  const order = state.bingoSongOrder;
  if (!order.length) return null;
  const i = Math.min(
    Math.max(0, state.bingoCurrentSongIndex),
    order.length - 1
  );
  return order[i] ?? null;
}

function getLeaderboardForGameSlot(slot: number): { name: string; score: number }[] {
  const state = getState();
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

function getFinalLeaderboard(): { nickname: string; totalScore: number }[] {
  const state = getState();
  const totals: Record<string, number> = {};
  state.players.forEach((p) => {
    totals[p.id] = 0;
  });
  GAMES.forEach((game) => {
    const scores = state.gameScores[game.id];
    if (!scores) return;
    state.players.forEach((p) => {
      totals[p.id] += scores[p.id] ?? 0;
    });
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

/**
 * Awards points for newly completed bingo rows/columns and optional full-card bonus
 * (honor system; geometric line keys must be valid).
 */
export function claimBingo(
  playerId: string,
  lineKeys: string[]
): BingoClaimResult | null {
  applyDueScheduledTransitions();
  applyDueTeamMcqRoundAdvance();
  applyDueBingoRoundEnd();
  const state = getState();
  if (state.guestStep !== "game_bingo") return null;
  if (!state.players.some((p) => p.id === playerId)) return null;

  const unique = [...new Set(lineKeys)];
  const priorClaimed = state.bingoClaimedLineKeysByPlayer[playerId] ?? [];
  const validNewLines = unique.filter(
    (k) =>
      BINGO_VALID_LINE_KEYS.has(k) &&
      !priorClaimed.includes(k) &&
      bingoLineFullyMarkedOnServer(state, playerId, k)
  );
  const fullNew =
    unique.includes(BINGO_FULL_CARD_CLAIM_KEY) &&
    !priorClaimed.includes(BINGO_FULL_CARD_CLAIM_KEY) &&
    bingoFullCardMarkedOnServer(state, playerId);

  if (validNewLines.length === 0 && !fullNew) {
    const cur = state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0;
    return {
      awarded: 0,
      totalForPlayer: cur,
      claimedLineKeys: [...priorClaimed],
    };
  }

  if (!state.gameScores[BINGO_GAME_ID]) {
    state.gameScores[BINGO_GAME_ID] = {};
  }
  const prev = state.gameScores[BINGO_GAME_ID]![playerId] ?? 0;
  const lineDelta = validNewLines.reduce(
    (sum, k) => sum + bingoPointsForValidLineKey(k),
    0
  );
  const delta = lineDelta + (fullNew ? BINGO_POINTS_FULL_CARD : 0);
  state.gameScores[BINGO_GAME_ID]![playerId] = prev + delta;
  state.bingoClaimedLineKeysByPlayer[playerId] = [
    ...priorClaimed,
    ...validNewLines,
    ...(fullNew ? [BINGO_FULL_CARD_CLAIM_KEY] : []),
  ];
  state.revision += 1;
  notifySessionChanged();
  return {
    awarded: delta,
    totalForPlayer: state.gameScores[BINGO_GAME_ID]![playerId]!,
    claimedLineKeys: state.bingoClaimedLineKeysByPlayer[playerId]!,
  };
}

export type BingoMarkResult =
  | { ok: true; marked: boolean[]; score: number; wrongTapPenalty: boolean }
  | {
      ok: false;
      error: "not_active" | "unknown_player" | "bad_cell" | "no_song";
    };

/** Test helper: control the shuffled playlist and playhead (used by `store.test.ts`). */
export function setBingoPlaybackForTests(order: string[], index: number): void {
  const state = getState();
  state.bingoSongOrder = [...order];
  state.bingoCurrentSongIndex = index;
}

/**
 * Mark or unmark a bingo cell. Turning a cell on is allowed only when its title
 * matches the server’s current song; otherwise the player loses {@link BINGO_WRONG_TAP_PENALTY}.
 */
export function markBingoCell(
  playerId: string,
  cellIndex: number,
  mark: boolean
): BingoMarkResult {
  applyDueScheduledTransitions();
  applyDueTeamMcqRoundAdvance();
  applyDueBingoRoundEnd();
  const state = getState();
  if (state.guestStep !== "game_bingo") {
    return { ok: false, error: "not_active" };
  }
  if (!state.players.some((p) => p.id === playerId)) {
    return { ok: false, error: "unknown_player" };
  }
  if (
    !Number.isInteger(cellIndex) ||
    cellIndex < 0 ||
    cellIndex >= BINGO_CELL_COUNT
  ) {
    return { ok: false, error: "bad_cell" };
  }

  const marks = normalizedBingoMarks(state.bingoMarkedByPlayer[playerId]);

  if (!mark) {
    marks[cellIndex] = false;
    state.bingoMarkedByPlayer[playerId] = marks;
    state.revision += 1;
    notifySessionChanged();
    const score = state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0;
    return { ok: true, marked: marks, score, wrongTapPenalty: false };
  }

  if (marks[cellIndex]) {
    const score = state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0;
    return { ok: true, marked: marks, score, wrongTapPenalty: false };
  }

  const current = currentBingoSongTitle(state);
  if (!current) {
    return { ok: false, error: "no_song" };
  }

  const cellTitle = bingoCardTitlesForPlayer(playerId)[cellIndex];
  if (cellTitle !== current) {
    if (!state.gameScores[BINGO_GAME_ID]) {
      state.gameScores[BINGO_GAME_ID] = {};
    }
    const prev = state.gameScores[BINGO_GAME_ID]![playerId] ?? 0;
    state.gameScores[BINGO_GAME_ID]![playerId] =
      prev - BINGO_WRONG_TAP_PENALTY;
    state.revision += 1;
    notifySessionChanged();
    const score = state.gameScores[BINGO_GAME_ID]![playerId] ?? 0;
    return { ok: true, marked: marks, score, wrongTapPenalty: true };
  }

  marks[cellIndex] = true;
  state.bingoMarkedByPlayer[playerId] = marks;
  state.revision += 1;
  notifySessionChanged();
  const score = state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0;
  return { ok: true, marked: marks, score, wrongTapPenalty: false };
}

export type AdminBingoAdvanceResult =
  | { ok: true }
  | { ok: false; error: "not_bingo" | "at_end" };

export function adminAdvanceBingoSong(): AdminBingoAdvanceResult {
  applyDueScheduledTransitions();
  applyDueTeamMcqRoundAdvance();
  applyDueBingoRoundEnd();
  const state = getState();
  if (state.guestStep !== "game_bingo") {
    return { ok: false, error: "not_bingo" };
  }
  const max = state.bingoSongOrder.length - 1;
  if (state.bingoCurrentSongIndex >= max) {
    return { ok: false, error: "at_end" };
  }
  state.bingoCurrentSongIndex += 1;
  state.revision += 1;
  notifySessionChanged();
  return { ok: true };
}

export type TriviaVoteResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "not_active"
        | "unknown_player"
        | "bad_question"
        | "bad_option"
        | "wrong_question";
    };

export function submitTriviaVote(
  playerId: string,
  questionId: string,
  optionIndex: number
): TriviaVoteResult {
  applyDueScheduledTransitions();
  applyDueTeamMcqRoundAdvance();
  applyDueBingoRoundEnd();
  const state = getState();
  if (state.guestStep !== "game_trivia") {
    return { ok: false, error: "not_active" };
  }
  if (!state.players.some((p) => p.id === playerId)) {
    return { ok: false, error: "unknown_player" };
  }
  if (!TRIVIA_QUESTION_IDS.has(questionId)) {
    return { ok: false, error: "bad_question" };
  }
  if (!isValidTriviaOptionIndex(optionIndex)) {
    return { ok: false, error: "bad_option" };
  }
  const activeId = activeTeamMcqQuestionId(state);
  if (questionId !== activeId) {
    return { ok: false, error: "wrong_question" };
  }
  const prev = state.triviaVotesByPlayer[playerId] ?? {};
  state.triviaVotesByPlayer[playerId] = { ...prev, [questionId]: optionIndex };
  return { ok: true };
}

export type QuoteVoteResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "not_active"
        | "unknown_player"
        | "bad_question"
        | "bad_option"
        | "wrong_question";
    };

export function submitQuoteVote(
  playerId: string,
  questionId: string,
  optionIndex: number
): QuoteVoteResult {
  applyDueScheduledTransitions();
  applyDueTeamMcqRoundAdvance();
  applyDueBingoRoundEnd();
  const state = getState();
  if (state.guestStep !== "game_quotes") {
    return { ok: false, error: "not_active" };
  }
  if (!state.players.some((p) => p.id === playerId)) {
    return { ok: false, error: "unknown_player" };
  }
  if (!quoteQuestionIds().has(questionId)) {
    return { ok: false, error: "bad_question" };
  }
  if (!isValidTriviaOptionIndex(optionIndex)) {
    return { ok: false, error: "bad_option" };
  }
  const activeId = activeTeamMcqQuestionId(state);
  if (questionId !== activeId) {
    return { ok: false, error: "wrong_question" };
  }
  const prev = state.quoteVotesByPlayer[playerId] ?? {};
  state.quoteVotesByPlayer[playerId] = { ...prev, [questionId]: optionIndex };
  return { ok: true };
}

export function registerPlayer(nickname: string): string {
  const id = generateId();
  const state = getState();
  state.players.push({ id, nickname });
  notifySessionChanged();
  return id;
}

export function getSessionState(): SessionState {
  applyDueScheduledTransitions();
  applyDueTeamMcqRoundAdvance();
  applyDueBingoRoundEnd();
  const state = getState();
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
  return (
    step === "lobby_trivia" ||
    step === "lobby_quotes" ||
    step === "game_trivia" ||
    step === "leaderboard_post_trivia" ||
    step === "game_quotes"
  );
}

export function getPublicState(playerId: string | null): PublicState {
  applyDueScheduledTransitions();
  applyDueTeamMcqRoundAdvance();
  applyDueBingoRoundEnd();
  const state = getState();
  const game = currentGameForPublic(state);
  let myTeam: Team | null = null;
  let myTeammateNicknames: string[] = [];
  if (
    playerId &&
    state.teams.length > 0 &&
    game &&
    shouldShowMyTeam(state, game)
  ) {
    myTeam = state.teams.find((t) => t.playerIds.includes(playerId)) ?? null;
    if (myTeam) {
      myTeammateNicknames = myTeam.playerIds
        .filter((id) => id !== playerId)
        .map((id) => state.players.find((p) => p.id === id)?.nickname ?? "?");
    }
  }

  const slot = gameSlotFromGuestStep(state.guestStep);
  const leaderboard =
    state.guestStep === "leaderboard_post_trivia" ||
    state.guestStep === "leaderboard_post_bingo"
      ? getLeaderboardForGameSlot(slot ?? 0)
      : [];

  const finalLeaderboard =
    state.guestStep === "leaderboard_final" ? getFinalLeaderboard() : [];

  const currentGameIndex = publicGameIndexFromGuestStep(state.guestStep);

  const lobbyTeams =
    state.guestStep === "lobby_trivia" || state.guestStep === "lobby_quotes"
      ? lobbyTeamsFromSession(state)
      : [];

  const myBingoClaimedLineKeys =
    state.guestStep === "game_bingo" && playerId
      ? [...(state.bingoClaimedLineKeysByPlayer[playerId] ?? [])]
      : [];

  const myBingoScore =
    state.guestStep === "game_bingo" && playerId
      ? state.gameScores[BINGO_GAME_ID]?.[playerId] ?? 0
      : 0;

  const bingoRoundEndsAtEpochMs =
    state.guestStep === "game_bingo"
      ? state.bingoRoundEndsAtEpochMs
      : null;

  const myBingoMarkedCells =
    state.guestStep === "game_bingo" && playerId
      ? normalizedBingoMarks(state.bingoMarkedByPlayer[playerId])
      : [];

  const myTriviaVotes =
    state.guestStep === "game_trivia" && playerId
      ? { ...(state.triviaVotesByPlayer[playerId] ?? {}) }
      : {};

  const myQuoteVotes =
    state.guestStep === "game_quotes" && playerId
      ? { ...(state.quoteVotesByPlayer[playerId] ?? {}) }
      : {};

  const playerKnownToSession =
    playerId == null || state.players.some((p) => p.id === playerId);

  const teamMcqSync =
    (state.guestStep === "game_trivia" || state.guestStep === "game_quotes") &&
    state.teamMcqRoundStartedAtEpochMs != null
      ? {
          questionIndex: state.teamMcqRoundIndex,
          roundStartedAtEpochMs: state.teamMcqRoundStartedAtEpochMs,
          totalQuestions:
            state.guestStep === "game_trivia"
              ? TRIVIA_QUESTIONS.length
              : getQuoteQuestions().length,
          answerMs: TEAM_MCQ_ANSWER_MS,
          revealMs: TEAM_MCQ_REVEAL_MS,
        }
      : null;

  return {
    guestStep: state.guestStep,
    revision: state.revision,
    syncRevision: state.revision,
    currentGameIndex,
    countdownRemaining: state.countdownRemaining,
    scheduledGameStartsAtEpochMs: state.scheduledGameStartsAtEpochMs,
    playerKnownToSession,
    currentGame: game,
    myTeam: myTeam ?? null,
    myTeammateNicknames,
    lobbyTeams,
    playerCount: state.players.length,
    leaderboard,
    finalLeaderboard,
    games: state.games,
    myBingoClaimedLineKeys,
    myBingoScore,
    bingoRoundEndsAtEpochMs,
    myBingoMarkedCells,
    myTriviaVotes,
    myQuoteVotes,
    teamMcqSync,
  };
}

export function advancePhase(): void {
  applyDueScheduledTransitions();
  applyDueTeamMcqRoundAdvance();
  applyDueBingoRoundEnd();
  const state = getState();
  const from = state.guestStep;

  if (
    LOBBY_STEPS_WITH_SCHEDULE.includes(from) &&
    state.scheduledGameStartsAtEpochMs != null
  ) {
    return;
  }

  if (
    LOBBY_STEPS_WITH_SCHEDULE.includes(from) &&
    state.scheduledGameStartsAtEpochMs == null
  ) {
    state.scheduledGameStartsAtEpochMs = Date.now() + LOBBY_PRE_GAME_LEAD_MS;
    state.revision += 1;
    notifySessionChanged();
    return;
  }

  const to = getNextGuestStep(from);
  if (!to) {
    return;
  }
  applyTransitionSideEffects(from, to);
  state.guestStep = to;
  state.scheduledGameStartsAtEpochMs = null;
  state.revision += 1;
  notifySessionChanged();
}

export function resetSession(): void {
  globalForStore.__nicola_store = {
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
  notifySessionChanged();
}
