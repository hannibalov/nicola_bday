export type GuestStep =
  | "party_protocol"
  | "lobby_trivia"
  | "game_trivia"
  | "leaderboard_post_trivia"
  | "lobby_bingo"
  | "game_bingo"
  | "leaderboard_post_bingo"
  | "lobby_quotes"
  | "game_quotes"
  | "leaderboard_final";

export const GUEST_STEP_SEQUENCE: readonly GuestStep[] = [
  "party_protocol",
  "lobby_trivia",
  "game_trivia",
  "leaderboard_post_trivia",
  "lobby_bingo",
  "game_bingo",
  "leaderboard_post_bingo",
  "lobby_quotes",
  "game_quotes",
  "leaderboard_final",
] as const;

export function getNextGuestStep(current: GuestStep): GuestStep | null {
  const i = GUEST_STEP_SEQUENCE.indexOf(current);
  if (i < 0 || i >= GUEST_STEP_SEQUENCE.length - 1) return null;
  return GUEST_STEP_SEQUENCE[i + 1]!;
}

export type GameType = "individual" | "team";

export interface Player {
  id: string;
  nickname: string;
}

export interface Team {
  id: string;
  name: string;
  playerIds: string[];
}

export interface GameConfig {
  id: string;
  name: string;
  type: GameType;
  countdownSeconds: number;
}

export interface SessionState {
  guestStep: GuestStep;
  revision: number;
  /** @deprecated Lobby countdown uses {@link scheduledGameStartsAtEpochMs}; kept for older tests. */
  countdownRemaining: number | null;
  /**
   * When set during a lobby step, server transitions to the matching game at this instant (after buffer + 60s + Go!).
   */
  scheduledGameStartsAtEpochMs: number | null;
  players: Player[];
  teams: Team[];
  gameScores: Record<string, Record<string, number>>; // gameId -> (playerId or teamId) -> points
  games: GameConfig[];
  /** During music bingo: winning line keys already scored per player (e.g. `"0,1,2"`). */
  bingoClaimedLineKeysByPlayer: Record<string, string[]>;
  /** During team trivia: `playerId` → `questionId` → chosen option index (0–3). */
  triviaVotesByPlayer: Record<string, Record<string, number>>;
  /** During “Who said it”: `playerId` → `quoteId` → chosen option index (0–3). */
  quoteVotesByPlayer: Record<string, Record<string, number>>;
}

/** Full team roster for trivia lobby (nicknames only; safe for all guests). */
export interface LobbyTeamRoster {
  name: string;
  nicknames: string[];
}

export interface PublicState {
  guestStep: GuestStep;
  revision: number;
  currentGameIndex: number;
  countdownRemaining: number | null;
  /** Same as session; clients derive local countdown from this + shared constants. */
  scheduledGameStartsAtEpochMs: number | null;
  currentGame: GameConfig | null;
  myTeam: Team | null;
  myTeammateNicknames: string[];
  /** Populated on `lobby_trivia` and `lobby_quotes`; empty otherwise. */
  lobbyTeams: LobbyTeamRoster[];
  /** Registered players on server (for lobby “how many here”). */
  playerCount: number;
  /**
   * False when the browser sent a playerId cookie that is not in the current session
   * (e.g. after host reset). Client should clear storage and re-check-in.
   */
  playerKnownToSession: boolean;
  leaderboard: { name: string; score: number }[];
  finalLeaderboard: { nickname: string; totalScore: number }[];
  games: GameConfig[];
  /** Monotonic revision for SSE; same as top-level revision when syncing. */
  syncRevision: number;
  /** Set on `game_bingo` for the requesting player — lines already claimed on the server. */
  myBingoClaimedLineKeys: string[];
  /** Live total for music bingo round (same step only). */
  myBingoScore: number;
  /** Server-backed trivia selections for this player during `game_trivia`. */
  myTriviaVotes: Record<string, number>;
  /** Server-backed quote selections for this player during `game_quotes`. */
  myQuoteVotes: Record<string, number>;
}

/** Slot 0 = trivia, 1 = bingo, 2 = quotes; null if not in an active game context. */
export function gameSlotFromGuestStep(step: GuestStep): number | null {
  switch (step) {
    case "lobby_trivia":
    case "game_trivia":
    case "leaderboard_post_trivia":
      return 0;
    case "lobby_bingo":
    case "game_bingo":
    case "leaderboard_post_bingo":
      return 1;
    case "lobby_quotes":
    case "game_quotes":
      return 2;
    default:
      return null;
  }
}

/** Index of the active game (0…n-1); defaults to 0 when not in a slotted step (e.g. protocol). */
export function publicGameIndexFromGuestStep(step: GuestStep): number {
  const slot = gameSlotFromGuestStep(step);
  if (slot !== null) return slot;
  return 0;
}
