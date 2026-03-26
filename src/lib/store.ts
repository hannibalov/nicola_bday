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
import {
  BINGO_FULL_CARD_CLAIM_KEY,
  BINGO_POINTS_FULL_CARD,
  BINGO_VALID_LINE_KEYS,
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
    state.gameScores[BINGO_GAME_ID] = {};
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
  const state = getState();
  if (state.guestStep !== "game_bingo") return null;
  if (!state.players.some((p) => p.id === playerId)) return null;

  const unique = [...new Set(lineKeys)];
  const priorClaimed = state.bingoClaimedLineKeysByPlayer[playerId] ?? [];
  const validNewLines = unique.filter(
    (k) => BINGO_VALID_LINE_KEYS.has(k) && !priorClaimed.includes(k)
  );
  const fullNew =
    unique.includes(BINGO_FULL_CARD_CLAIM_KEY) &&
    !priorClaimed.includes(BINGO_FULL_CARD_CLAIM_KEY);

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
    myTriviaVotes,
    myQuoteVotes,
    teamMcqSync,
  };
}

export function advancePhase(): void {
  applyDueScheduledTransitions();
  applyDueTeamMcqRoundAdvance();
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
    triviaVotesByPlayer: {},
    quoteVotesByPlayer: {},
    scheduledGameStartsAtEpochMs: null,
    teamMcqRoundIndex: 0,
    teamMcqRoundStartedAtEpochMs: null,
  };
  notifySessionChanged();
}
