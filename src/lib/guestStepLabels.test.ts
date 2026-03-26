import type { GuestStep } from "@/types";
import { GUEST_STEP_SEQUENCE } from "@/types";
import { guestStepLabel, nextGuestStepLabel } from "./guestStepLabels";

describe("guestStepLabel", () => {
  it("has a non-empty label for every step in the sequence", () => {
    for (const step of GUEST_STEP_SEQUENCE) {
      const label = guestStepLabel(step);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(step);
    }
  });
});

describe("nextGuestStepLabel", () => {
  it("returns the human label for the next step", () => {
    expect(nextGuestStepLabel("party_protocol")).toBe(guestStepLabel("lobby_trivia"));
  });

  it("returns null at the end of the flow", () => {
    const end: GuestStep = "leaderboard_final";
    expect(nextGuestStepLabel(end)).toBeNull();
  });
});
