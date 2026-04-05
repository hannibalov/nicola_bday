import {
  shouldAdminPanelUseWebSocket,
  shouldGuestPlayViewUseWebSocket,
  parseWebSocketPayload,
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
  it("guest uses WebSocket by default", () => {
    delete process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE;
    expect(shouldGuestPlayViewUseWebSocket(new URLSearchParams())).toBe(
      true,
    );
  });

  it("guest skips WebSocket when protocolTest=1", () => {
    delete process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE;
    expect(
      shouldGuestPlayViewUseWebSocket(
        new URLSearchParams("protocolTest=1&nickname=a"),
      ),
    ).toBe(false);
  });

  it("guest skips WebSocket when NEXT_PUBLIC_NICOLA_DISABLE_SSE=1", () => {
    process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE = "1";
    expect(shouldGuestPlayViewUseWebSocket(new URLSearchParams())).toBe(
      false,
    );
  });

  it("admin uses WebSocket unless disable env is set", () => {
    delete process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE;
    expect(shouldAdminPanelUseWebSocket()).toBe(true);
    process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE = "1";
    expect(shouldAdminPanelUseWebSocket()).toBe(false);
  });
});

describe("parseWebSocketPayload", () => {
  it("parses a valid WebSocket payload", () => {
    const raw = JSON.stringify({
      revision: 3,
      guestStep: "lobby_trivia",
      playerCount: 5,
    });
    expect(parseWebSocketPayload(raw)).toEqual({
      revision: 3,
      guestStep: "lobby_trivia",
      playerCount: 5,
    });
  });

  it("returns null for invalid JSON", () => {
    expect(parseWebSocketPayload("not-json")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(parseWebSocketPayload(JSON.stringify({ revision: 1 }))).toBeNull();
  });

  it("returns null when revision is not a number", () => {
    const raw = JSON.stringify({
      revision: "3",
      guestStep: "party_protocol",
      playerCount: 0,
    });
    expect(parseWebSocketPayload(raw)).toBeNull();
  });

  it("returns null when playerCount is missing", () => {
    const raw = JSON.stringify({ revision: 1, guestStep: "party_protocol" });
    expect(parseWebSocketPayload(raw)).toBeNull();
  });
});
