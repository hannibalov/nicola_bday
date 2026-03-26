/**
 * Party protocol CTA is locked until 11 Apr 2026 00:01 (Europe/Barcelona).
 * Countdown copy targets the event start the same day at 20:00 Barcelona.
 *
 * CEST applies in April (DST begins late March in the EU).
 */

/** 11 Apr 2026 00:01 local — advance button unlocks. */
export const PARTY_PROTOCOL_UNLOCK_ISO = "2026-04-11T00:01:00+02:00";

/** 11 Apr 2026 20:00 local — shown in “date & place” and countdown. */
export const PARTY_EVENT_START_ISO = "2026-04-11T20:00:00+02:00";

export const PARTY_MAPS_URL =
  "https://maps.app.goo.gl/rDdqbZLDH79ZrXnf6" as const;

export function partyProtocolUnlockEpochMs(): number {
  return Date.parse(PARTY_PROTOCOL_UNLOCK_ISO);
}

export function partyEventStartEpochMs(): number {
  return Date.parse(PARTY_EVENT_START_ISO);
}

export function isProtocolContinueUnlocked(nowMs: number): boolean {
  return nowMs >= partyProtocolUnlockEpochMs();
}

export type EventCountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  totalMsRemaining: number;
};

/** Remaining time until event start (20:00); all zeros once past. */
export function countdownToPartyEventParts(
  nowMs: number
): EventCountdownParts {
  const end = partyEventStartEpochMs();
  const totalMsRemaining = Math.max(0, end - nowMs);
  const totalMinutes = Math.floor(totalMsRemaining / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes, totalMsRemaining };
}

export function isProtocolGateBypassed(
  envFlag: string | undefined,
  searchParamProtocolTest: string | null
): boolean {
  if (envFlag === "1") return true;
  return searchParamProtocolTest === "1";
}
