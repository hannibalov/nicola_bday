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
import { resetTestTables } from "@/lib/supabase";

const mockCookies: Record<string, string> = {};

jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: any, options?: any) => ({
      status: options?.status || 200,
      json: async () => data,
    }),
  },
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(() => Promise.resolve({
    get: (name: string) => mockCookies[name] ? { value: mockCookies[name] } : undefined
  })),
}));

jest.setTimeout(30000);
beforeEach(async () => {
  await resetSession();
  Object.keys(mockCookies).forEach(k => delete mockCookies[k]);
});

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
    const res = await POST({
      url: "http://localhost/api/game/bingo/mark",
      method: "POST",
      json: async () => ({ cellIndex: 0, mark: true }),
      headers: {
        get: (name: string) => undefined,
      },
    } as any);
    expect(res.status).toBe(401);
  });

  it("returns marked cells when the tile matches the current song", async () => {
    const id = await registerPlayer("A");
    await advanceUntilGameBingo();
    const titles = bingoCardTitlesForPlayer(id);
    await setBingoPlaybackForTests([titles[0]], 0);
    mockCookies.playerId = id;

    const res = await POST({
      url: "http://localhost/api/game/bingo/mark",
      method: "POST",
      json: async () => ({ cellIndex: 0, mark: true }),
      headers: {
        get: (name: string) => name === "cookie" ? `playerId=${encodeURIComponent(id)}` : undefined,
      },
    } as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.marked[0]).toBe(true);
    expect(data.wrongTapPenalty).toBe(false);
  });
});
