/**
 * Party protocol screen: countdown to event start (Europe/Barcelona).
 * CEST applies in April (DST begins late March in the EU).
 */

/** 11 Apr 2026 20:00 local — shown in “date & place” and countdown. */
export const PARTY_EVENT_START_ISO = "2026-04-11T20:00:00+02:00";

export const PARTY_MAPS_URL =
  "https://maps.app.goo.gl/rDdqbZLDH79ZrXnf6" as const;

export function partyEventStartEpochMs(): number {
  return Date.parse(PARTY_EVENT_START_ISO);
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
