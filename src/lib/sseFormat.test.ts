import { formatSseData } from "./sseFormat";

describe("formatSseData", () => {
  it("serializes objects as JSON SSE frame", () => {
    expect(formatSseData({ revision: 2, guestStep: "party_protocol" })).toBe(
      'data: {"revision":2,"guestStep":"party_protocol"}\n\n'
    );
  });
});
