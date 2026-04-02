/**
 * @jest-environment node
 */
import { POST } from "./route";
import {
  advancePhase,
  getSessionState,
  registerPlayer,
  resetSession,
} from "@/lib/store";

const headersMock = jest.fn();

jest.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

jest.setTimeout(30000);
jest.setTimeout(30000); beforeEach(async () => {
  await resetSession();
  headersMock.mockResolvedValue({
    get: (name: string) => (name === "x-admin-key" ? "admin-secret" : null),
  });
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

describe("POST /api/admin/bingo-advance-song", () => {
  it("returns 401 without admin key", async () => {
    headersMock.mockResolvedValueOnce({
      get: () => null,
    });
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("advances bingoCurrentSongIndex during game_bingo", async () => {
    await registerPlayer("A");
    await advanceUntilGameBingo();
    expect((await getSessionState()).bingoCurrentSongIndex).toBe(0);

    const res = await POST();
    expect(res.status).toBe(200);
    expect((await getSessionState()).bingoCurrentSongIndex).toBe(1);
  });
});
