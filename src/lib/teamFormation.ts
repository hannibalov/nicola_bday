import type { Team } from "@/types";

/**
 * How many teams to form for n registered players.
 * - n < 10: 2 teams (capped at n when fewer than 2 players)
 * - 10 ≤ n < 20: 4 teams
 * - n ≥ 20: enough teams that no team exceeds 7 players, sizes balanced (diff ≤ 1)
 */
export function teamCountForPlayerCount(n: number): number {
  if (n <= 0) return 0;
  if (n < 10) return Math.min(2, n);
  if (n < 20) return Math.min(4, n);
  return Math.ceil(n / 7);
}

/** Split n into k group sizes (sum = n), each differing by at most one. */
export function distributePlayerCounts(n: number, k: number): number[] {
  if (k <= 0) return [];
  const base = Math.floor(n / k);
  const rem = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < rem ? 1 : 0));
}

/**
 * Builds Team 1…k from already-shuffled player ids (caller shuffles for fairness).
 */
export function teamsFromShuffledPlayerIds(shuffledIds: string[]): Team[] {
  const n = shuffledIds.length;
  const k = teamCountForPlayerCount(n);
  if (k === 0) return [];

  const sizes = distributePlayerCounts(n, k);
  const teams: Team[] = [];
  let offset = 0;
  for (let i = 0; i < k; i++) {
    const sz = sizes[i]!;
    teams.push({
      id: `team-${i + 1}`,
      name: `Team ${i + 1}`,
      playerIds: shuffledIds.slice(offset, offset + sz),
    });
    offset += sz;
  }
  return teams;
}
