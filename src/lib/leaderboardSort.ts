/**
 * Leaderboard ordering: descending score, then ascending name (stable tie-break).
 */

export interface LeaderboardEntry {
  name: string;
  score: number;
}

export function sortLeaderboardEntries<T extends LeaderboardEntry>(
  entries: T[]
): T[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
