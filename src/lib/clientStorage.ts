import {
  isProtocolTestSearchMode,
  PROTOCOL_TEST_NICKNAME_QP,
  PROTOCOL_TEST_QP,
  type SearchParamsLike,
} from "./protocolTestMode";

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

/** Per-tab protocol-test guest identity (`/?protocolTest=1&nickname=…`). */
export const KEYS_PT = {
  playerId: `${STORAGE_PREFIX}pt-playerId`,
  nickname: `${STORAGE_PREFIX}pt-nickname`,
} as const;

/** `playerId` cookie only (no localStorage). */
export function getCookiePlayerId(): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)playerId=([^;]*)/);
  if (!match?.[1]) return null;
  const raw = match[1].trim();
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Cookie or localStorage backup — use on `/play` before hitting the API (normal guests). */
export function getPersistedPlayerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLs = window.localStorage.getItem(KEYS.playerId);
    if (fromLs) return fromLs;
  } catch {
    /* private mode */
  }
  return getCookiePlayerId();
}

/** Identity for the current URL when `protocolTest=1` (sessionStorage, per browser tab). */
export function persistProtocolTestPlayerProfile(profile: {
  playerId: string;
  nickname: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEYS_PT.playerId, profile.playerId);
    window.sessionStorage.setItem(KEYS_PT.nickname, profile.nickname);
  } catch {
    /* quota / private mode */
  }
}

export function getProtocolTestPlayerProfile(): {
  playerId: string;
  nickname: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const playerId = window.sessionStorage.getItem(KEYS_PT.playerId);
    const nickname = window.sessionStorage.getItem(KEYS_PT.nickname);
    if (playerId && nickname) return { playerId, nickname };
    return null;
  } catch {
    return null;
  }
}

export function clearProtocolTestPlayerProfile(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEYS_PT.playerId);
    window.sessionStorage.removeItem(KEYS_PT.nickname);
  } catch {
    /* private mode */
  }
}

/**
 * Player id for API calls / gating. Normal flow uses localStorage + cookie;
 * protocol test with query params uses per-tab sessionStorage only (not
 * localStorage) so multiple tabs can register different nicknames.
 */
export function getGuestPlayerIdForClient(
  searchParams: SearchParamsLike,
): string | null {
  if (!isProtocolTestSearchMode(searchParams.get(PROTOCOL_TEST_QP))) {
    return getPersistedPlayerId();
  }
  const urlNick = searchParams.get(PROTOCOL_TEST_NICKNAME_QP)?.trim() ?? "";
  const pt = getProtocolTestPlayerProfile();
  if (urlNick) {
    if (pt && pt.nickname === urlNick) return pt.playerId;
    return null;
  }
  if (pt) return pt.playerId;
  return getCookiePlayerId();
}

export function getGuestNicknameForClient(
  searchParams: SearchParamsLike,
): string | null {
  if (!isProtocolTestSearchMode(searchParams.get(PROTOCOL_TEST_QP))) {
    return getPersistedNickname();
  }
  const urlNick = searchParams.get(PROTOCOL_TEST_NICKNAME_QP)?.trim() ?? "";
  if (urlNick) return urlNick;
  return getProtocolTestPlayerProfile()?.nickname ?? null;
}

/** After `POST /api/players` — use sessionStorage in protocol-test URLs only. */
export function persistGuestProfile(
  profile: { playerId: string; nickname: string },
  protocolTestUrl: boolean,
): void {
  if (protocolTestUrl) {
    persistProtocolTestPlayerProfile(profile);
    return;
  }
  persistPlayerProfile(profile);
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
  clearProtocolTestPlayerProfile();
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
