import {
  buildProtocolTestPreserveQuery,
  isProtocolTestSearchMode,
  withProtocolTestQuery,
} from "./protocolTestMode";

describe("protocolTestMode", () => {
  it("isProtocolTestSearchMode is true only for 1", () => {
    expect(isProtocolTestSearchMode("1")).toBe(true);
    expect(isProtocolTestSearchMode("true")).toBe(false);
    expect(isProtocolTestSearchMode(null)).toBe(false);
  });

  it("buildProtocolTestPreserveQuery returns empty when not in test mode", () => {
    expect(buildProtocolTestPreserveQuery(new URLSearchParams())).toBe("");
    expect(
      buildProtocolTestPreserveQuery(new URLSearchParams("foo=bar")),
    ).toBe("");
  });

  it("buildProtocolTestPreserveQuery keeps protocolTest and optional nickname", () => {
    const a = buildProtocolTestPreserveQuery(
      new URLSearchParams("protocolTest=1"),
    );
    expect(a).toBe("protocolTest=1");

    const b = buildProtocolTestPreserveQuery(
      new URLSearchParams("protocolTest=1&nickname=Tab%20A"),
    );
    expect(b).toContain("protocolTest=1");
    expect(b).toContain("nickname=");
    expect(decodeURIComponent(new URLSearchParams(b).get("nickname")!)).toBe(
      "Tab A",
    );
  });

  it("withProtocolTestQuery appends only when protocolTest=1", () => {
    expect(
      withProtocolTestQuery("/play", new URLSearchParams("protocolTest=1")),
    ).toBe("/play?protocolTest=1");
    expect(withProtocolTestQuery("/play", new URLSearchParams())).toBe("/play");
  });
});
