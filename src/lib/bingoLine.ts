/**
 * Music bingo grid: 2 rows × 3 cols (6 cells), indices row-major:
 * [0,1,2]
 * [3,4,5]
 */

/** Row lines are harder (3 songs); columns are 2 songs; full card is a one-time jackpot. */
export const BINGO_POINTS_ROW = 100;
export const BINGO_POINTS_COLUMN = 50;
export const BINGO_POINTS_FULL_CARD = 500;

/** Sentinel stored in `bingoClaimedLineKeysByPlayer` (not a geometric line). */
export const BINGO_FULL_CARD_CLAIM_KEY = "full";

export const BINGO_ROWS = 2;
export const BINGO_COLS = 3;
export const BINGO_CELL_COUNT = BINGO_ROWS * BINGO_COLS;

/** Full rows and columns on a 2×3 grid (no diagonals). */
export const BINGO_WIN_LINES: ReadonlyArray<readonly number[]> = [
  [0, 1, 2],
  [3, 4, 5],
  [0, 3],
  [1, 4],
  [2, 5],
];

export function bingoLineKey(line: readonly number[]): string {
  return line.join(",");
}

const BINGO_ROW_LINE_KEYS: ReadonlySet<string> = new Set([
  bingoLineKey([0, 1, 2]),
  bingoLineKey([3, 4, 5]),
]);

export function bingoPointsForValidLineKey(lineKey: string): number {
  return BINGO_ROW_LINE_KEYS.has(lineKey) ? BINGO_POINTS_ROW : BINGO_POINTS_COLUMN;
}

export const BINGO_VALID_LINE_KEYS: ReadonlySet<string> = new Set(
  BINGO_WIN_LINES.map(bingoLineKey)
);

/** Keys for every row/column that is fully marked. */
export function completedBingoLineKeys(marked: Set<number> | number[]): string[] {
  const set = marked instanceof Set ? marked : new Set(marked);
  return BINGO_WIN_LINES.filter((line) =>
    line.every((i) => set.has(i))
  ).map(bingoLineKey);
}

/** Returns true if marked cells include a full winning line (row or column). */
export function hasCompleteBingoLine(marked: Set<number> | number[]): boolean {
  const set = marked instanceof Set ? marked : new Set(marked);
  return BINGO_WIN_LINES.some((line) => line.every((i) => set.has(i)));
}

/** Cell indices for a valid row/column key; `null` if not a winning line. */
export function bingoIndicesForLineKey(lineKey: string): number[] | null {
  for (const line of BINGO_WIN_LINES) {
    if (bingoLineKey(line) === lineKey) {
      return [...line];
    }
  }
  return null;
}
