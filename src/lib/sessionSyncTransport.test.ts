import {
  shouldAdminPanelUseEventSource,
  shouldGuestPlayViewUseEventSource,
  parseSsePayload,
} from "./sessionSyncTransport";

const origDisable = process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE;

afterEach(() => {
  if (origDisable === undefined) {
    delete process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE;
  } else {
    process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE = origDisable;
  }
});

describe("sessionSyncTransport", () => {
  it("guest uses SSE by default", () => {
    delete process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE;
    expect(shouldGuestPlayViewUseEventSource(new URLSearchParams())).toBe(
      true,
    );
  });

  it("guest skips SSE when protocolTest=1", () => {
    delete process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE;
    expect(
      shouldGuestPlayViewUseEventSource(
        new URLSearchParams("protocolTest=1&nickname=a"),
      ),
    ).toBe(false);
  });

  it("guest skips SSE when NEXT_PUBLIC_NICOLA_DISABLE_SSE=1", () => {
    process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE = "1";
    expect(shouldGuestPlayViewUseEventSource(new URLSearchParams())).toBe(
      false,
    );
  });

  it("admin uses SSE unless disable env is set", () => {
    delete process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE;
    expect(shouldAdminPanelUseEventSource()).toBe(true);
    process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE = "1";
    expect(shouldAdminPanelUseEventSource()).toBe(false);
  });
});

describe("parseSsePayload", () => {
  it("parses a valid SSE payload", () => {
    const raw = JSON.stringify({
      revision: 3,
      guestStep: "lobby_trivia",
      playerCount: 5,
    });
    expect(parseSsePayload(raw)).toEqual({
      revision: 3,
      guestStep: "lobby_trivia",
      playerCount: 5,
    });
  });

  it("returns null for invalid JSON", () => {
    expect(parseSsePayload("not-json")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(parseSsePayload(JSON.stringify({ revision: 1 }))).toBeNull();
  });

  it("returns null when revision is not a number", () => {
    const raw = JSON.stringify({
      revision: "3",
      guestStep: "party_protocol",
      playerCount: 0,
    });
    expect(parseSsePayload(raw)).toBeNull();
  });

  it("returns null when playerCount is missing", () => {
    const raw = JSON.stringify({ revision: 1, guestStep: "party_protocol" });
    expect(parseSsePayload(raw)).toBeNull();
  });
});
