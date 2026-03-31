/**
 * @jest-environment node
 */
import { POST } from "./route";
import {
  advancePhase,
  getSessionState,
  registerPlayer,
  resetSession,
  applyDueScheduledTransitions,
  setBingoPlaybackForTests,
  markBingoCell,
} from "@/lib/store";
import { bingoCardTitlesForPlayer } from "@/lib/bingoCard";

beforeEach(() => {
  resetSession();
});

function authJsonHeaders(playerId: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Cookie: `playerId=${encodeURIComponent(playerId)}`,
  };
}

function advanceUntilGameBingo() {
  let guard = 0;
  while (getSessionState().guestStep !== "game_bingo" && guard < 40) {
    advancePhase();
    const t = getSessionState().scheduledGameStartsAtEpochMs;
    if (t != null) applyDueScheduledTransitions(t + 1);
    guard++;
  }
  expect(getSessionState().guestStep).toBe("game_bingo");
}

describe("POST /api/game/bingo/claim", () => {
  it("returns 401 without playerId cookie", async () => {
    const res = await POST(
      new Request("http://localhost/api/game/bingo/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineKeys: ["0,1,2"] }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when not in game_bingo", async () => {
    const id = registerPlayer("A");
    const res = await POST(
      new Request("http://localhost/api/game/bingo/claim", {
        method: "POST",
        headers: authJsonHeaders(id),
        body: JSON.stringify({ lineKeys: ["0,1,2"] }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("awards points when in game_bingo", async () => {
    const id = registerPlayer("A");
    advanceUntilGameBingo();
    const titles = bingoCardTitlesForPlayer(id);
    const pad = "__pad__";
    const order = [titles[0]!, titles[1]!, titles[2]!, pad, pad, pad];
    setBingoPlaybackForTests(order, 0);
    markBingoCell(id, 0, true);
    setBingoPlaybackForTests(order, 1);
    markBingoCell(id, 1, true);
    setBingoPlaybackForTests(order, 2);
    markBingoCell(id, 2, true);

    const res = await POST(
      new Request("http://localhost/api/game/bingo/claim", {
        method: "POST",
        headers: authJsonHeaders(id),
        body: JSON.stringify({ lineKeys: ["0,1,2"] }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.awarded).toBe(100);
    expect(data.totalForPlayer).toBe(100);
  });
});
