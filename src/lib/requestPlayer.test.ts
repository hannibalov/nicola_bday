/**
 * @jest-environment node
 */
import { registerPlayer, resetSession } from "@/lib/store";
import {
  NICOLA_PLAYER_ID_HEADER,
  resolvePlayerIdFromRequest,
} from "./requestPlayer";

beforeEach(() => {
  resetSession();
});

describe("resolvePlayerIdFromRequest", () => {
  it("reads playerId from Cookie when no header override applies", () => {
    const id = registerPlayer("A");
    const req = new Request("http://localhost/api/state", {
      headers: { Cookie: `playerId=${encodeURIComponent(id)}` },
    });
    expect(resolvePlayerIdFromRequest(req)).toBe(id);
  });

  it("under test NODE_ENV prefers x-nicola-player-id over cookie", () => {
    const fromCookie = registerPlayer("CookieUser");
    const fromHeader = registerPlayer("HeaderUser");
    const req = new Request("http://localhost/api/state", {
      headers: {
        Cookie: `playerId=${encodeURIComponent(fromCookie)}`,
        [NICOLA_PLAYER_ID_HEADER]: fromHeader,
      },
    });
    expect(resolvePlayerIdFromRequest(req)).toBe(fromHeader);
  });

  it("returns null when cookie absent", () => {
    const req = new Request("http://localhost/api/state");
    expect(resolvePlayerIdFromRequest(req)).toBeNull();
  });
});
