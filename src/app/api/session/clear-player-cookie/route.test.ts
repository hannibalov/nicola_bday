/**
 * @jest-environment node
 */
import { POST } from "./route";

describe("POST /api/session/clear-player-cookie", () => {
  it("returns ok and clears playerId cookie", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/playerId=/i);
  });
});
