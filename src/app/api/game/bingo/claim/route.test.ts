/**
 * @jest-environment node
 */
import { POST } from "./route";
import {
  advancePhase,
  getSessionState,
  registerPlayer,
  resetSession,
  setBingoPlaybackForTests,
  markBingoCell,
} from "@/lib/store";
import { bingoCardTitlesForPlayer } from "@/lib/bingoCard";

jest.setTimeout(30000);
jest.setTimeout(30000); beforeEach(async () => {
  await resetSession();
});

function authJsonHeaders(playerId: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Cookie: `playerId=${encodeURIComponent(playerId)}`,
  };
}

async function advanceUntilGameBingo() {
  let guard = 0;
  let now = Date.now();
  while (guard < 40) {
    const s = await getSessionState(now);
    if (s.guestStep === "game_bingo") break;
    await advancePhase(now);
    now += 10000; // Skip 10s each iteration
    guard++;
  }
  expect((await getSessionState(now)).guestStep).toBe("game_bingo");
}

describe("POST /api/game/bingo/claim", () => {
  jest.setTimeout(30000);
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
    const id = await registerPlayer("A");
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
    const id = await registerPlayer("A");
    await advanceUntilGameBingo();
    const titles = bingoCardTitlesForPlayer(id);
    const pad = "__pad__";
    const order = [titles[0], titles[1], titles[2], pad, pad, pad];
    await setBingoPlaybackForTests(order, 0);
    await markBingoCell(id, 0, true);
    await setBingoPlaybackForTests(order, 1);
    await markBingoCell(id, 1, true);
    await setBingoPlaybackForTests(order, 2);
    await markBingoCell(id, 2, true);

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
