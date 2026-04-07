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
import { TRIVIA_QUESTIONS } from "@/content/trivia";
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

async function advanceUntilGameTrivia() {
  await registerPlayer("Alice");
  let guard = 0;
  let now = Date.now();
  while (guard < 40) {
    const s = await getSessionState(now);
    if (s.guestStep === "game_trivia") break;
    await advancePhase(now);
    const after = await getSessionState(now);
    if (after.scheduledGameStartsAtEpochMs != null) {
      now = after.scheduledGameStartsAtEpochMs + 1;
    } else {
      now += 1000;
    }
    guard++;
  }
  expect((await getSessionState()).guestStep).toBe("game_trivia");
}

describe("POST /api/game/trivia/vote", () => {
  it("returns 401 without playerId cookie", async () => {
    const res = await POST({
      url: "http://localhost/api/game/trivia/vote",
      method: "POST",
      json: async () => ({ questionId: TRIVIA_QUESTIONS[0].id, optionIndex: 0 }),
      headers: {
        get: () => undefined,
      },
    } as any);
    expect(res.status).toBe(401);
  });

  it("returns 400 when trivia is not active", async () => {
    const id = await registerPlayer("Bob");
    mockCookies.playerId = id;
    const res = await POST({
      url: "http://localhost/api/game/trivia/vote",
      method: "POST",
      json: async () => ({ questionId: TRIVIA_QUESTIONS[0].id, optionIndex: 0 }),
      headers: {
        get: (name: string) => name === "cookie" ? `playerId=${encodeURIComponent(id)}` : undefined,
      },
    } as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("not_active");
  });

  it("records vote during game_trivia", async () => {
    await advanceUntilGameTrivia();
    const state = await getSessionState();
    const id = state.players[0]!.id;
    const q = TRIVIA_QUESTIONS[state.teamMcqRoundIndex];
    const res = await POST({
      url: "http://localhost/api/game/trivia/vote",
      method: "POST",
      json: async () => ({ questionId: q.id, optionIndex: q.correctIndex }),
      headers: {
        get: (name: string) => name === "cookie" ? `playerId=${encodeURIComponent(id)}` : undefined,
      },
    } as any);
    expect(res.status).toBe(200);
    const after = await getSessionState();
    expect(after.triviaVotesByPlayer[id]?.[q.id]).toBe(q.correctIndex);
  });

  it("returns 400 for unknown question id", async () => {
    await advanceUntilGameTrivia();
    const id = (await getSessionState()).players[0]!.id;
    const res = await POST(
      new Request("http://localhost/api/game/trivia/vote", {
        method: "POST",
        body: JSON.stringify({ questionId: "nope", optionIndex: 0 }),
        headers: authJsonHeaders(id),
      })
    );
    expect(res.status).toBe(400);
  });
});
