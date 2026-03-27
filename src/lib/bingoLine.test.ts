import {
  BINGO_POINTS_COLUMN,
  BINGO_POINTS_ROW,
  BINGO_VALID_LINE_KEYS,
  bingoLineKey,
  bingoPointsForValidLineKey,
  bingoIndicesForLineKey,
  completedBingoLineKeys,
  hasCompleteBingoLine,
} from "./bingoLine";

describe("hasCompleteBingoLine", () => {
  it("is false when empty", () => {
    expect(hasCompleteBingoLine([])).toBe(false);
  });

  it("detects top row", () => {
    expect(hasCompleteBingoLine([0, 1, 2])).toBe(true);
  });

  it("detects bottom row", () => {
    expect(hasCompleteBingoLine([3, 4, 5])).toBe(true);
  });

  it("detects columns", () => {
    expect(hasCompleteBingoLine([0, 3])).toBe(true);
    expect(hasCompleteBingoLine([1, 4])).toBe(true);
    expect(hasCompleteBingoLine([2, 5])).toBe(true);
  });

  it("is false for diagonal-only partial", () => {
    expect(hasCompleteBingoLine([0, 4])).toBe(false);
  });
});

describe("bingoPointsForValidLineKey", () => {
  it("scores rows higher than columns", () => {
    expect(bingoPointsForValidLineKey("0,1,2")).toBe(BINGO_POINTS_ROW);
    expect(bingoPointsForValidLineKey("3,4,5")).toBe(BINGO_POINTS_ROW);
    expect(bingoPointsForValidLineKey("0,3")).toBe(BINGO_POINTS_COLUMN);
    expect(bingoPointsForValidLineKey("1,4")).toBe(BINGO_POINTS_COLUMN);
    expect(bingoPointsForValidLineKey("2,5")).toBe(BINGO_POINTS_COLUMN);
  });
});

describe("bingoIndicesForLineKey", () => {
  it("maps keys to cell indices", () => {
    expect(bingoIndicesForLineKey("0,1,2")).toEqual([0, 1, 2]);
    expect(bingoIndicesForLineKey("0,3")).toEqual([0, 3]);
    expect(bingoIndicesForLineKey("nope")).toBeNull();
  });
});

describe("bingoLineKey / completedBingoLineKeys", () => {
  it("uses stable keys for every winning line", () => {
    expect(bingoLineKey([0, 1, 2])).toBe("0,1,2");
    expect(BINGO_VALID_LINE_KEYS.has("0,1,2")).toBe(true);
    expect(BINGO_VALID_LINE_KEYS.has("not-a-line")).toBe(false);
  });

  it("lists all completed lines for a full card (5 lines)", () => {
    const keys = completedBingoLineKeys([0, 1, 2, 3, 4, 5]);
    expect(keys.sort()).toEqual(
      ["0,1,2", "0,3", "1,4", "2,5", "3,4,5"].sort()
    );
  });

  it("returns one key when only the top row is marked", () => {
    expect(completedBingoLineKeys([0, 1, 2])).toEqual(["0,1,2"]);
  });
});
