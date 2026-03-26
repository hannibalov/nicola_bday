import {
  pluralityWinner,
  resolveMajorityByTeam,
  teamChoiceMatchesCorrect,
} from "./majorityVote";

describe("pluralityWinner", () => {
  it("returns null for empty votes", () => {
    expect(pluralityWinner([])).toBeNull();
  });

  it("returns the only choice", () => {
    expect(pluralityWinner([2])).toBe(2);
  });

  it("returns majority choice", () => {
    expect(pluralityWinner([0, 0, 1, 2, 0])).toBe(0);
  });

  it("on tie picks lower index", () => {
    expect(pluralityWinner([0, 0, 1, 1])).toBe(0);
    expect(pluralityWinner([1, 1, 0, 0])).toBe(0);
  });

  it("ignores negative indices for counting", () => {
    expect(pluralityWinner([-1, 1, 1, 1])).toBe(1);
  });
});

describe("resolveMajorityByTeam", () => {
  it("matches pluralityWinner semantics", () => {
    expect(resolveMajorityByTeam([0, 1, 0])).toBe(0);
    expect(resolveMajorityByTeam([])).toBeNull();
  });
});

describe("teamChoiceMatchesCorrect", () => {
  it("is true when plurality matches correctIndex", () => {
    expect(teamChoiceMatchesCorrect([0, 0, 1], 0)).toBe(true);
  });

  it("is false when plurality differs", () => {
    expect(teamChoiceMatchesCorrect([0, 1, 1, 1], 0)).toBe(false);
  });
});
