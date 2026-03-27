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
} from "@/lib/store";

const headersMock = jest.fn();

jest.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

beforeEach(() => {
  resetSession();
  headersMock.mockResolvedValue({
    get: (name: string) => (name === "x-admin-key" ? "admin-secret" : null),
  });
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

describe("POST /api/admin/bingo-advance-song", () => {
  it("returns 401 without admin key", async () => {
    headersMock.mockResolvedValueOnce({
      get: () => null,
    });
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("advances bingoCurrentSongIndex during game_bingo", async () => {
    registerPlayer("A");
    advanceUntilGameBingo();
    expect(getSessionState().bingoCurrentSongIndex).toBe(0);

    const res = await POST();
    expect(res.status).toBe(200);
    expect(getSessionState().bingoCurrentSongIndex).toBe(1);
  });
});
