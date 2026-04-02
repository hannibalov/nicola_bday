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
    now += 10000;
    guard++;
  }
}

describe("POST /api/game/bingo/mark", () => {
  it("returns 401 without playerId cookie", async () => {
    const res = await POST(
      new Request("http://localhost/api/game/bingo/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cellIndex: 0, mark: true }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns marked cells when the tile matches the current song", async () => {
    const id = await registerPlayer("A");
    await advanceUntilGameBingo();
    const titles = bingoCardTitlesForPlayer(id);
    await setBingoPlaybackForTests([titles[0]], 0);

    const res = await POST(
      new Request("http://localhost/api/game/bingo/mark", {
        method: "POST",
        headers: authJsonHeaders(id),
        body: JSON.stringify({ cellIndex: 0, mark: true }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.marked[0]).toBe(true);
    expect(data.wrongTapPenalty).toBe(false);
  });
});
