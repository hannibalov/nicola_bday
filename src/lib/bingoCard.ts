import { BINGO_SONG_TITLES } from "@/content/bingo";
import { BINGO_CELL_COUNT } from "@/lib/bingoLine";

/** Mulberry32 PRNG from numeric seed. */
function mulberry32(seed: number): () => number {
  let s = seed;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bingoSeedForPlayer(playerId: string): number {
  let h = 0;
  for (let i = 0; i < playerId.length; i++) {
    h = Math.imul(31, h) + playerId.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

/** Picks 6 distinct song titles for a 2×3 card using a deterministic seed from `playerId`. */
export function bingoCardTitlesForPlayer(playerId: string): string[] {
  const pool = [...BINGO_SONG_TITLES];
  const rnd = mulberry32(bingoSeedForPlayer(playerId));
  const picked: string[] = [];
  const n = Math.min(BINGO_CELL_COUNT, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rnd() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    picked.push(pool[i]);
  }
  return picked;
}
