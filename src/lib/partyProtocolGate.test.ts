import {
  countdownToPartyEventParts,
  partyEventStartEpochMs,
} from "./partyProtocolGate";

describe("partyProtocolGate", () => {
  const eventStart = partyEventStartEpochMs();

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
});
