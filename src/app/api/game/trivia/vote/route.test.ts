/**
 * @jest-environment node
 */
import { POST } from "./route";
import {
  resetSession,
  registerPlayer,
  advancePhase,
  getSessionState,
  applyDueScheduledTransitions,
} from "@/lib/store";
import { TRIVIA_QUESTIONS } from "@/content/trivia";

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

function advanceUntilGameTrivia() {
  registerPlayer("Alice");
  let guard = 0;
  while (getSessionState().guestStep !== "game_trivia" && guard < 40) {
    advancePhase();
    const t = getSessionState().scheduledGameStartsAtEpochMs;
    if (t != null) applyDueScheduledTransitions(t + 1);
    guard++;
  }
  expect(getSessionState().guestStep).toBe("game_trivia");
}

describe("POST /api/game/trivia/vote", () => {
  it("returns 401 without playerId cookie", async () => {
    const res = await POST(
      new Request("http://localhost/api/game/trivia/vote", {
        method: "POST",
        body: JSON.stringify({ questionId: TRIVIA_QUESTIONS[0].id, optionIndex: 0 }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when trivia is not active", async () => {
    const id = registerPlayer("Bob");
    mockCookies.set("playerId", id);
    const res = await POST(
      new Request("http://localhost/api/game/trivia/vote", {
        method: "POST",
        body: JSON.stringify({ questionId: TRIVIA_QUESTIONS[0].id, optionIndex: 0 }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("not_active");
  });

  it("records vote during game_trivia", async () => {
    advanceUntilGameTrivia();
    const id = getSessionState().players[0]!.id;
    mockCookies.set("playerId", id);
    const q = TRIVIA_QUESTIONS[0];
    const res = await POST(
      new Request("http://localhost/api/game/trivia/vote", {
        method: "POST",
        body: JSON.stringify({ questionId: q.id, optionIndex: q.correctIndex }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    expect(getSessionState().triviaVotesByPlayer[id]?.[q.id]).toBe(
      q.correctIndex
    );
  });

  it("returns 400 for unknown question id", async () => {
    advanceUntilGameTrivia();
    const id = getSessionState().players[0]!.id;
    mockCookies.set("playerId", id);
    const res = await POST(
      new Request("http://localhost/api/game/trivia/vote", {
        method: "POST",
        body: JSON.stringify({ questionId: "nope", optionIndex: 0 }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
  });
});
