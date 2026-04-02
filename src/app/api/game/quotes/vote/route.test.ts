/**
 * @jest-environment node
 */
import { POST } from "./route";
import {
  resetSession,
  registerPlayer,
  advancePhase,
  getSessionState,
} from "@/lib/store";
import { getQuoteQuestions } from "@/lib/quoteContent";
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

beforeEach(async () => {
  resetTestTables();
  await resetSession();
  Object.keys(mockCookies).forEach(k => delete mockCookies[k]);
});

function authJsonHeaders(playerId: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Cookie: `playerId=${encodeURIComponent(playerId)}`,
  };
}

async function advanceUntilGameQuotes() {
  await registerPlayer("Alice");
  let guard = 0;
  let now = Date.now();
  while (guard < 50) {
    const s = await getSessionState(now);
    if (s.guestStep === "game_quotes") break;
    await advancePhase(now);
    const after = await getSessionState(now);
    if (after.scheduledGameStartsAtEpochMs != null) {
      now = after.scheduledGameStartsAtEpochMs + 1;
    } else {
      now += 1000;
    }
    guard++;
  }
  expect((await getSessionState()).guestStep).toBe("game_quotes");
}

describe("POST /api/game/quotes/vote", () => {
  it("returns 401 without playerId cookie", async () => {
    const res = await POST(
      new Request("http://localhost/api/game/quotes/vote", {
        method: "POST",
        body: JSON.stringify({
          questionId: getQuoteQuestions()[0].id,
          optionIndex: 0,
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when quotes game is not active", async () => {
    const id = await registerPlayer("Bob");
    const res = await POST({
      url: "http://localhost/api/game/quotes/vote",
      method: "POST",
      json: async () => ({
        questionId: getQuoteQuestions()[0].id,
        optionIndex: 0,
      }),
      headers: {
        get: (name: string) => name === "cookie" ? `playerId=${encodeURIComponent(id)}` : undefined,
      },
    } as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("not_active");
  });

  it("records vote during game_quotes", async () => {
    await advanceUntilGameQuotes();
    const state = await getSessionState();
    const id = state.players[0]!.id;
    const q = getQuoteQuestions()[state.teamMcqRoundIndex];
    const res = await POST({
      url: "http://localhost/api/game/quotes/vote",
      method: "POST",
      json: async () => ({
        questionId: q.id,
        optionIndex: q.correctIndex,
      }),
      headers: {
        get: (name: string) => name === "cookie" ? `playerId=${encodeURIComponent(id)}` : undefined,
      },
    } as any);
    expect(res.status).toBe(200);
    const after = await getSessionState();
    expect(after.quoteVotesByPlayer[id]?.[q.id]).toBe(q.correctIndex);
  });

  it("returns 400 for unknown question id", async () => {
    await advanceUntilGameQuotes();
    const id = (await getSessionState()).players[0]!.id;
    const res = await POST(
      new Request("http://localhost/api/game/quotes/vote", {
        method: "POST",
        body: JSON.stringify({ questionId: "nope", optionIndex: 0 }),
        headers: authJsonHeaders(id),
      })
    );
    expect(res.status).toBe(400);
  });
});
