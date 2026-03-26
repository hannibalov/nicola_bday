/** localStorage keys for guest resilience (prefix matches ARCHITECTURE §7.2). */

export const STORAGE_PREFIX = "nicola-bday:" as const;

/** @deprecated Use STORAGE_PREFIX — kept for tests and older imports */
export const NICOLA_STORAGE_PREFIX = STORAGE_PREFIX;

export const KEYS = {
  playerId: `${STORAGE_PREFIX}playerId`,
  nickname: `${STORAGE_PREFIX}nickname`,
  partyProtocolComplete: `${STORAGE_PREFIX}party-protocol-complete`,
  lastKnownStep: `${STORAGE_PREFIX}lastKnownStep`,
  triviaAnswers: `${STORAGE_PREFIX}triviaAnswers`,
  bingo: `${STORAGE_PREFIX}bingo`,
  quoteVotes: `${STORAGE_PREFIX}quoteVotes`,
} as const;

/** Cookie or localStorage backup — use on `/play` before hitting the API. */
export function getPersistedPlayerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLs = window.localStorage.getItem(KEYS.playerId);
    if (fromLs) return fromLs;
  } catch {
    /* private mode */
  }
  const match = document.cookie.match(/(?:^|;\s*)playerId=([^;]*)/);
  if (!match?.[1]) return null;
  const raw = match[1].trim();
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function getPersistedNickname(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEYS.nickname);
  } catch {
    return null;
  }
}

export function markPartyProtocolComplete(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.partyProtocolComplete, "1");
  } catch {
    /* quota / private mode */
  }
}

export function hasCompletedPartyProtocol(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEYS.partyProtocolComplete) === "1";
  } catch {
    return false;
  }
}

export type SerializableJson = string;

export function setLocalJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode */
  }
}

export function getLocalJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setLastKnownStep(step: string, revision: number): void {
  setLocalJson(KEYS.lastKnownStep, { step, revision, at: Date.now() });
}

export function getLastKnownStep(): { step: string; revision: number; at: number } | null {
  return getLocalJson(KEYS.lastKnownStep);
}

/** Persisted music bingo card — marked cells survive refresh (docs/game-music-bingo.md). */
export type BingoLocalState = {
  playerId: string;
  seed: number;
  titles: string[];
  marked: boolean[];
};

export function getBingoLocal(): BingoLocalState | null {
  return getLocalJson<BingoLocalState>(KEYS.bingo);
}

export function setBingoLocal(payload: BingoLocalState): void {
  setLocalJson(KEYS.bingo, payload);
}

export function clearBingoLocal(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEYS.bingo);
  } catch {
    /* quota / private mode */
  }
}

/** `questionId` → option index (0–3), offline cache for trivia (docs/game-trivia-team.md). */
export type TriviaAnswersLocal = Record<string, number>;

export function getTriviaAnswersLocal(): TriviaAnswersLocal | null {
  return getLocalJson<TriviaAnswersLocal>(KEYS.triviaAnswers);
}

export function setTriviaAnswersLocal(answers: TriviaAnswersLocal): void {
  setLocalJson(KEYS.triviaAnswers, answers);
}

export function persistPlayerProfile(profile: {
  playerId: string;
  nickname: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS.playerId, profile.playerId);
    window.localStorage.setItem(KEYS.nickname, profile.nickname);
  } catch {
    /* quota / private mode */
  }
}

/** After host reset or stale cookie: wipe guest identity and game cache so `/` check-in runs again. */
export function clearGuestRegistrationForRejoin(): void {
  if (typeof window === "undefined") return;
  const keys = [
    KEYS.playerId,
    KEYS.nickname,
    KEYS.partyProtocolComplete,
    KEYS.lastKnownStep,
    KEYS.triviaAnswers,
    KEYS.bingo,
    KEYS.quoteVotes,
  ];
  try {
    for (const k of keys) {
      window.localStorage.removeItem(k);
    }
  } catch {
    /* private mode */
  }
}
