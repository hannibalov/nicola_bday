import {
  shouldAdminPanelUseEventSource,
  shouldGuestPlayViewUseEventSource,
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
