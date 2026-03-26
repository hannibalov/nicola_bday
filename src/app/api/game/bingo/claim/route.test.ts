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
} from "@/lib/store";

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
    mockCookies.set("playerId", id);
    const res = await POST(
      new Request("http://localhost/api/game/bingo/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineKeys: ["0,1,2"] }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("awards points when in game_bingo", async () => {
    const id = registerPlayer("A");
    mockCookies.set("playerId", id);
    advanceUntilGameBingo();
    const res = await POST(
      new Request("http://localhost/api/game/bingo/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineKeys: ["0,1,2"] }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.awarded).toBe(500);
    expect(data.totalForPlayer).toBe(500);
  });
});
