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
import { getQuoteQuestions } from "@/lib/quoteContent";

beforeEach(() => {
  resetSession();
});

function authJsonHeaders(playerId: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Cookie: `playerId=${encodeURIComponent(playerId)}`,
  };
}

function advanceUntilGameQuotes() {
  registerPlayer("Alice");
  let guard = 0;
  while (getSessionState().guestStep !== "game_quotes" && guard < 50) {
    advancePhase();
    const t = getSessionState().scheduledGameStartsAtEpochMs;
    if (t != null) applyDueScheduledTransitions(t + 1);
    guard++;
  }
  expect(getSessionState().guestStep).toBe("game_quotes");
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
    const id = registerPlayer("Bob");
    const res = await POST(
      new Request("http://localhost/api/game/quotes/vote", {
        method: "POST",
        body: JSON.stringify({
          questionId: getQuoteQuestions()[0].id,
          optionIndex: 0,
        }),
        headers: authJsonHeaders(id),
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("not_active");
  });

  it("records vote during game_quotes", async () => {
    advanceUntilGameQuotes();
    const id = getSessionState().players[0]!.id;
    const q = getQuoteQuestions()[0];
    const res = await POST(
      new Request("http://localhost/api/game/quotes/vote", {
        method: "POST",
        body: JSON.stringify({
          questionId: q.id,
          optionIndex: q.correctIndex,
        }),
        headers: authJsonHeaders(id),
      })
    );
    expect(res.status).toBe(200);
    expect(getSessionState().quoteVotesByPlayer[id]?.[q.id]).toBe(
      q.correctIndex
    );
  });

  it("returns 400 for unknown question id", async () => {
    advanceUntilGameQuotes();
    const id = getSessionState().players[0]!.id;
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
