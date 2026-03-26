/**
 * Integration: multiple route handlers against one in-memory store (mirrors production wiring).
 * @jest-environment node
 */
import { POST as postPlayers } from "@/app/api/players/route";
import { GET as getState } from "@/app/api/state/route";
import { POST as postAdminStartNext } from "@/app/api/admin/start-next/route";
import { POST as postAdminReset } from "@/app/api/admin/reset/route";
import { GET as getAdminState } from "@/app/api/admin/state/route";
import { POST as postTriviaVote } from "@/app/api/game/trivia/vote/route";
import { POST as postBingoClaim } from "@/app/api/game/bingo/claim/route";
import { POST as postQuoteVote } from "@/app/api/game/quotes/vote/route";
import {
  resetSession,
  getSessionState,
  applyDueScheduledTransitions,
} from "@/lib/store";
import type { GuestStep } from "@/types";
import { TRIVIA_QUESTIONS } from "@/content/trivia";
import { getQuoteQuestions } from "@/lib/quoteContent";
import { GAMES } from "@/lib/gameConfig";
import type { PublicState } from "@/types";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "admin-secret";

const mockCookies = new Map<string, string>();

jest.mock("next/headers", () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: (name: string) => ({ value: mockCookies.get(name) ?? undefined }),
    })
  ),
  headers: jest.fn(() => Promise.resolve({ get: () => null })),
}));

function setPlayerCookie(playerId: string | null) {
  mockCookies.delete("playerId");
  if (playerId) mockCookies.set("playerId", playerId);
}

async function registerViaApi(nickname: string): Promise<string> {
  const res = await postPlayers(
    new Request("http://localhost/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    })
  );
  expect(res.status).toBe(200);
  const data = (await res.json()) as { playerId: string };
  expect(typeof data.playerId).toBe("string");
  return data.playerId;
}

async function readPublicState(): Promise<PublicState> {
  const res = await getState();
  expect(res.status).toBe(200);
  return (await res.json()) as PublicState;
}

async function adminStartNext(): Promise<void> {
  const res = await postAdminStartNext(
    new Request(
      `http://localhost/api/admin/start-next?key=${encodeURIComponent(ADMIN_SECRET)}`,
      { method: "POST" }
    )
  );
  expect(res.status).toBe(200);
}

async function advanceGuestStepUntil(target: GuestStep) {
  let guard = 0;
  while (getSessionState().guestStep !== target && guard < 50) {
    await adminStartNext();
    const t = getSessionState().scheduledGameStartsAtEpochMs;
    if (t != null) applyDueScheduledTransitions(t + 1);
    guard++;
  }
  expect(getSessionState().guestStep).toBe(target);
}

beforeEach(() => {
  resetSession();
  mockCookies.clear();
});

describe("session flow integration (HTTP + store)", () => {
  it("registers players via API and exposes shared playerCount to each guest", async () => {
    const a = await registerViaApi("Alpha");
    const b = await registerViaApi("Beta");
    expect(a).not.toBe(b);

    setPlayerCookie(a);
    const pubA = await readPublicState();
    expect(pubA.playerCount).toBe(2);

    setPlayerCookie(b);
    const pubB = await readPublicState();
    expect(pubB.playerCount).toBe(2);
    expect(pubB.guestStep).toBe("party_protocol");
  });

  it("admin state reflects players and advances in sync with public state", async () => {
    await registerViaApi("HostCheck");
    const adminBefore = await getAdminState(
      new Request(
        `http://localhost/api/admin/state?key=${encodeURIComponent(ADMIN_SECRET)}`
      )
    );
    expect(adminBefore.status).toBe(200);
    const sessionBefore = (await adminBefore.json()) as { players: { nickname: string }[] };
    expect(sessionBefore.players).toHaveLength(1);

    await adminStartNext();
    setPlayerCookie(null);
    const pub = await readPublicState();
    expect(pub.guestStep).toBe("lobby_trivia");
    expect(pub.lobbyTeams.length).toBeGreaterThanOrEqual(1);
  });

  it("full trivia segment: votes via API persist and leaderboard appears after admin advance", async () => {
    const id = await registerViaApi("SoloTrivia");
    await advanceGuestStepUntil("game_trivia");

    setPlayerCookie(id);
    const q = TRIVIA_QUESTIONS[0];
    const voteRes = await postTriviaVote(
      new Request("http://localhost/api/game/trivia/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.id, optionIndex: q.correctIndex }),
      })
    );
    expect(voteRes.status).toBe(200);

    const mid = await readPublicState();
    expect(mid.myTriviaVotes[q.id]).toBe(q.correctIndex);

    await adminStartNext();
    const afterGame = await readPublicState();
    expect(afterGame.guestStep).toBe("leaderboard_post_trivia");
    expect(afterGame.leaderboard.length).toBeGreaterThanOrEqual(1);
    // Team trivia leaderboard entries are team names, not player nicknames.
    expect(afterGame.leaderboard.some((e) => /^Team \d+/.test(e.name))).toBe(true);
  });

  it("rejects trivia vote when wrong phase (breaking: vote during lobby)", async () => {
    const id = await registerViaApi("EarlyVoter");
    await advanceGuestStepUntil("lobby_trivia");

    setPlayerCookie(id);
    const res = await postTriviaVote(
      new Request("http://localhost/api/game/trivia/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: TRIVIA_QUESTIONS[0].id,
          optionIndex: 0,
        }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("bingo: claim via API updates public myBingoScore while in game_bingo", async () => {
    const id = await registerViaApi("BingoUser");
    await advanceGuestStepUntil("game_bingo");

    setPlayerCookie(id);
    const claimRes = await postBingoClaim(
      new Request("http://localhost/api/game/bingo/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineKeys: ["0,1,2"] }),
      })
    );
    expect(claimRes.status).toBe(200);
    const claimJson = (await claimRes.json()) as { awarded: number; totalForPlayer: number };
    expect(claimJson.awarded).toBeGreaterThan(0);

    const pub = await readPublicState();
    expect(pub.myBingoScore).toBe(claimJson.totalForPlayer);
    expect(pub.myBingoClaimedLineKeys).toContain("0,1,2");
  });

  it("quotes: vote via API then final leaderboard exposes totals", async () => {
    const id = await registerViaApi("QuoteUser");
    await advanceGuestStepUntil("game_quotes");
    const q0 = getQuoteQuestions()[0];

    setPlayerCookie(id);
    const voteRes = await postQuoteVote(
      new Request("http://localhost/api/game/quotes/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q0.id, optionIndex: q0.correctIndex }),
      })
    );
    expect(voteRes.status).toBe(200);
    const pubVotes = await readPublicState();
    expect(pubVotes.myQuoteVotes[q0.id]).toBe(q0.correctIndex);

    await adminStartNext();
    const fin = await readPublicState();
    expect(fin.guestStep).toBe("leaderboard_final");
    expect(fin.finalLeaderboard.some((e) => e.nickname === "QuoteUser")).toBe(true);
  });

  it("after reset, guest with stale cookie gets playerKnownToSession false until they rejoin", async () => {
    const id = await registerViaApi("RejoinMe");
    setPlayerCookie(id);
    let pub = await readPublicState();
    expect(pub.playerKnownToSession).toBe(true);
    expect(pub.playerCount).toBe(1);

    const resetRes = await postAdminReset(
      new Request(
        `http://localhost/api/admin/reset?key=${encodeURIComponent(ADMIN_SECRET)}`,
        { method: "POST" }
      )
    );
    expect(resetRes.status).toBe(200);

    setPlayerCookie(id);
    pub = await readPublicState();
    expect(pub.playerKnownToSession).toBe(false);
    expect(pub.playerCount).toBe(0);

    await registerViaApi("RejoinAfterReset");
    setPlayerCookie(null);
    const anon = await readPublicState();
    expect(anon.playerCount).toBe(1);
    expect(anon.playerKnownToSession).toBe(true);
  });

  it("admin reset clears session for public and admin views", async () => {
    await registerViaApi("Gone");
    await adminStartNext();
    const resetRes = await postAdminReset(
      new Request(
        `http://localhost/api/admin/reset?key=${encodeURIComponent(ADMIN_SECRET)}`,
        { method: "POST" }
      )
    );
    expect(resetRes.status).toBe(200);

    setPlayerCookie(null);
    const pub = await readPublicState();
    expect(pub.playerCount).toBe(0);
    expect(pub.guestStep).toBe("party_protocol");

    const adminRes = await getAdminState(
      new Request(
        `http://localhost/api/admin/state?key=${encodeURIComponent(ADMIN_SECRET)}`
      )
    );
    const session = (await adminRes.json()) as { players: unknown[] };
    expect(session.players).toHaveLength(0);
  });

  it("rejects admin reset with bad key", async () => {
    const res = await postAdminReset(
      new Request("http://localhost/api/admin/reset?key=wrong", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });

  it("trivia scoring integration: team all-correct matches store round scores", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      ids.push(await registerViaApi(`TeamP${i}`));
    }
    await advanceGuestStepUntil("game_trivia");
    const teamA = getSessionState().teams[0]!;
    for (const q of TRIVIA_QUESTIONS) {
      for (const pid of teamA.playerIds) {
        setPlayerCookie(pid);
        const r = await postTriviaVote(
          new Request("http://localhost/api/game/trivia/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: q.id, optionIndex: q.correctIndex }),
          })
        );
        expect(r.status).toBe(200);
      }
    }
    await adminStartNext();
    const board = getSessionState().gameScores[GAMES[0].id]!;
    const expected = TRIVIA_QUESTIONS.length * 50;
    teamA.playerIds.forEach((pid) => {
      expect(board[pid]).toBe(expected);
    });
  });
});
