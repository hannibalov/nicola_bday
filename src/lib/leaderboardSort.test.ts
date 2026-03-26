import { sortLeaderboardEntries } from "./leaderboardSort";

describe("sortLeaderboardEntries", () => {
  it("sorts by score descending", () => {
    expect(
      sortLeaderboardEntries([
        { name: "A", score: 10 },
        { name: "B", score: 50 },
        { name: "C", score: 30 },
      ]).map((e) => e.name)
    ).toEqual(["B", "C", "A"]);
  });

  it("breaks ties by name ascending (case-insensitive)", () => {
    expect(
      sortLeaderboardEntries([
        { name: "zebra", score: 100 },
        { name: "Alice", score: 100 },
        { name: "bob", score: 100 },
      ]).map((e) => e.name)
    ).toEqual(["Alice", "bob", "zebra"]);
  });

  it("returns empty for empty input", () => {
    expect(sortLeaderboardEntries([])).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const orig = [{ name: "B", score: 1 }, { name: "A", score: 2 }];
    sortLeaderboardEntries(orig);
    expect(orig[0]).toEqual({ name: "B", score: 1 });
  });
});
