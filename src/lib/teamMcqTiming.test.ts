import { TEAM_MCQ_ANSWER_MS, TEAM_MCQ_CYCLE_MS, TEAM_MCQ_REVEAL_MS } from "./teamMcqTiming";

describe("teamMcqTiming", () => {
  it("cycle is answer plus reveal", () => {
    expect(TEAM_MCQ_CYCLE_MS).toBe(TEAM_MCQ_ANSWER_MS + TEAM_MCQ_REVEAL_MS);
  });
});
