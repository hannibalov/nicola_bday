/**
 * @jest-environment node
 */
import { POST } from "./route";
import {
  advancePhase,
  applyDueScheduledTransitions,
  getSessionState,
  registerPlayer,
  resetSession,
  setBingoPlaybackForTests,
} from "@/lib/store";
import { bingoCardTitlesForPlayer } from "@/lib/bingoCard";

const mockCookies = new Map<string, string>();

jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: (name: string) => ({ value: mockCookies.get(name) ?? undefined }),
    })
  ),
}));

beforeEach(() => {
  resetSession();
  mockCookies.clear();
});

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
    const id = registerPlayer("A");
    mockCookies.set("playerId", id);
    advanceUntilGameBingo();
    const titles = bingoCardTitlesForPlayer(id);
    setBingoPlaybackForTests([titles[0]!], 0);

    const res = await POST(
      new Request("http://localhost/api/game/bingo/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cellIndex: 0, mark: true }),
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { marked: boolean[]; wrongTapPenalty: boolean };
    expect(data.marked[0]).toBe(true);
    expect(data.wrongTapPenalty).toBe(false);
  });
});
