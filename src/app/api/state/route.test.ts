/**
 * @jest-environment node
 */
import { GET } from "./route";
import { resetSession, registerPlayer } from "@/lib/store";

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

describe("GET /api/state", () => {
  it("returns public state with party_protocol when no playerId cookie", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.guestStep).toBe("party_protocol");
    expect(data.revision).toBe(0);
    expect(data.currentGameIndex).toBeDefined();
    expect(data.games).toBeDefined();
  });

  it("returns public state with playerId from cookie", async () => {
    const id = registerPlayer("Bob");
    mockCookies.set("playerId", id);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.guestStep).toBe("party_protocol");
    expect(data.playerKnownToSession).toBe(true);
  });

  it("playerKnownToSession false when cookie survives host reset", async () => {
    const id = registerPlayer("Zed");
    mockCookies.set("playerId", id);
    let data = await (await GET()).json();
    expect(data.playerKnownToSession).toBe(true);

    resetSession();
    mockCookies.set("playerId", id);
    data = await (await GET()).json();
    expect(data.playerKnownToSession).toBe(false);
    expect(data.playerCount).toBe(0);
  });
});
