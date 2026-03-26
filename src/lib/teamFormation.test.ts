import {
  teamCountForPlayerCount,
  distributePlayerCounts,
  teamsFromShuffledPlayerIds,
} from "./teamFormation";

describe("teamCountForPlayerCount", () => {
  it("returns 0 for empty", () => {
    expect(teamCountForPlayerCount(0)).toBe(0);
  });

  it("uses 2 teams below 10 players (capped by n)", () => {
    expect(teamCountForPlayerCount(1)).toBe(1);
    expect(teamCountForPlayerCount(2)).toBe(2);
    expect(teamCountForPlayerCount(9)).toBe(2);
  });

  it("uses 4 teams from 10 up to 19", () => {
    expect(teamCountForPlayerCount(10)).toBe(4);
    expect(teamCountForPlayerCount(15)).toBe(4);
    expect(teamCountForPlayerCount(19)).toBe(4);
  });

  it("uses ceil(n/7) for 20+ players (max 7 per team)", () => {
    expect(teamCountForPlayerCount(20)).toBe(3);
    expect(teamCountForPlayerCount(21)).toBe(3);
    expect(teamCountForPlayerCount(29)).toBe(5);
    expect(teamCountForPlayerCount(30)).toBe(5);
    expect(teamCountForPlayerCount(35)).toBe(5);
    expect(teamCountForPlayerCount(36)).toBe(6);
  });
});

describe("distributePlayerCounts", () => {
  it("balances sizes (diff at most 1)", () => {
    expect(distributePlayerCounts(10, 4)).toEqual([3, 3, 2, 2]);
    expect(distributePlayerCounts(9, 2)).toEqual([5, 4]);
    expect(distributePlayerCounts(20, 3)).toEqual([7, 7, 6]);
    expect(distributePlayerCounts(30, 5)).toEqual([6, 6, 6, 6, 6]);
    expect(distributePlayerCounts(34, 5)).toEqual([7, 7, 7, 7, 6]);
  });
});

describe("teamsFromShuffledPlayerIds", () => {
  it("splits 9 players into 2 balanced teams", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const teams = teamsFromShuffledPlayerIds(ids);
    expect(teams).toHaveLength(2);
    expect(teams[0]!.playerIds.length + teams[1]!.playerIds.length).toBe(9);
    const sizes = teams.map((t) => t.playerIds.length).sort((x, y) => y - x);
    expect(sizes).toEqual([5, 4]);
  });

  it("splits 14 players into 4 teams", () => {
    const ids = Array.from({ length: 14 }, (_, i) => `p${i}`);
    const teams = teamsFromShuffledPlayerIds(ids);
    expect(teams).toHaveLength(4);
    expect(teams.flatMap((t) => t.playerIds)).toHaveLength(14);
    const sortedSizes = teams.map((t) => t.playerIds.length).sort((a, b) => b - a);
    expect(sortedSizes).toEqual([4, 4, 3, 3]);
  });

  it("limits team size to 7 for 30 players", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `p${i}`);
    const teams = teamsFromShuffledPlayerIds(ids);
    expect(teams).toHaveLength(5);
    teams.forEach((t) => {
      expect(t.playerIds.length).toBeLessThanOrEqual(7);
      expect(t.playerIds.length).toBeGreaterThanOrEqual(6);
    });
  });

  it("returns empty for no players", () => {
    expect(teamsFromShuffledPlayerIds([])).toEqual([]);
  });
});
