import { bingoCardTitlesForPlayer } from "./bingoCard";
import { BINGO_CELL_COUNT } from "./bingoLine";

describe("bingoCardTitlesForPlayer", () => {
  it("returns six distinct titles", () => {
    const card = bingoCardTitlesForPlayer("player-abc");
    expect(card).toHaveLength(BINGO_CELL_COUNT);
    expect(new Set(card).size).toBe(BINGO_CELL_COUNT);
  });

  it("is deterministic per playerId", () => {
    expect(bingoCardTitlesForPlayer("same")).toEqual(bingoCardTitlesForPlayer("same"));
  });

  it("differs across player ids", () => {
    expect(bingoCardTitlesForPlayer("a")).not.toEqual(bingoCardTitlesForPlayer("b"));
  });
});
