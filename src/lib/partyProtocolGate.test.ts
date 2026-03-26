import {
  countdownToPartyEventParts,
  isProtocolContinueUnlocked,
  isProtocolGateBypassed,
  partyEventStartEpochMs,
  partyProtocolUnlockEpochMs,
} from "./partyProtocolGate";

describe("partyProtocolGate", () => {
  const unlock = partyProtocolUnlockEpochMs();
  const eventStart = partyEventStartEpochMs();

  it("unlock is before event start same day", () => {
    expect(unlock).toBeLessThan(eventStart);
  });

  it("isProtocolContinueUnlocked is false before unlock instant", () => {
    expect(isProtocolContinueUnlocked(unlock - 60_000)).toBe(false);
  });

  it("isProtocolContinueUnlocked is true at unlock instant", () => {
    expect(isProtocolContinueUnlocked(unlock)).toBe(true);
  });

  it("countdown reaches zero at or after event start", () => {
    const atStart = countdownToPartyEventParts(eventStart);
    expect(atStart.days).toBe(0);
    expect(atStart.hours).toBe(0);
    expect(atStart.minutes).toBe(0);
    expect(atStart.totalMsRemaining).toBe(0);
  });

  it("countdown splits days hours minutes before event", () => {
    const d = new Date(eventStart);
    d.setDate(d.getDate() - 2);
    d.setHours(12, 0, 0, 0);
    const parts = countdownToPartyEventParts(d.getTime());
    expect(parts.days).toBeGreaterThanOrEqual(1);
    expect(parts.totalMsRemaining).toBeGreaterThan(0);
  });

  it("isProtocolGateBypassed respects env and query", () => {
    expect(isProtocolGateBypassed(undefined, null)).toBe(false);
    expect(isProtocolGateBypassed("1", null)).toBe(true);
    expect(isProtocolGateBypassed(undefined, "1")).toBe(true);
    expect(isProtocolGateBypassed("0", "x")).toBe(false);
  });
});
