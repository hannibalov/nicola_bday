import { parseQuoteQuestions, getQuoteQuestions } from "./quoteContent";

describe("parseQuoteQuestions", () => {
  it("accepts the bundled 15-item pack", () => {
    const qs = getQuoteQuestions();
    expect(qs).toHaveLength(15);
    qs.forEach((q) => {
      expect(q.options).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThanOrEqual(3);
    });
  });

  it("rejects wrong count", () => {
    expect(() => parseQuoteQuestions([])).toThrow(/15/);
  });

  it("rejects invalid options length", () => {
    const bad = {
      id: "bad",
      quote: "hi",
      options: ["a", "b"],
      correctIndex: 0,
    };
    const items = Array.from({ length: 15 }, (_, i) =>
      i === 0
        ? bad
        : {
            id: `q${i}`,
            quote: `"${i}"`,
            options: ["a", "b", "c", "d"],
            correctIndex: 0,
          }
    );
    expect(() => parseQuoteQuestions(items)).toThrow(/4 strings/);
  });

  it("rejects bad correctIndex", () => {
    expect(() =>
      parseQuoteQuestions(
        Array.from({ length: 15 }, (_, i) => ({
          id: `q${i}`,
          quote: `"${i}"`,
          options: ["a", "b", "c", "d"],
          correctIndex: 4,
        }))
      )
    ).toThrow(/0–3/);
  });
});
