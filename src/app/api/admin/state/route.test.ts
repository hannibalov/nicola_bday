/**
 * @jest-environment node
 */
import { GET } from "./route";
import { POST as POSTPlayers } from "@/app/api/players/route";
import { resetSession, registerPlayer } from "@/lib/store";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "admin-secret";

jest.mock("next/headers", () => ({
  headers: jest.fn(() => Promise.resolve({ get: () => null })),
}));

beforeEach(() => {
  resetSession();
});

describe("GET /api/admin/state", () => {
  it("returns 401 without admin key", async () => {
    const res = await GET(new Request("http://localhost/api/admin/state"));
    expect(res.status).toBe(401);
  });

  it("returns full state with key in query", async () => {
    registerPlayer("Alice");
    const res = await GET(
      new Request(`http://localhost/api/admin/state?key=${ADMIN_SECRET}`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.guestStep).toBe("party_protocol");
    expect(data.players).toHaveLength(1);
    expect(data.players[0].nickname).toBe("Alice");
  });

  it("returns updated player list after a player registers via POST /api/players", async () => {
    const getRes = await GET(
      new Request(`http://localhost/api/admin/state?key=${ADMIN_SECRET}`)
    );
    const initial = await getRes.json();
    expect(initial.players).toHaveLength(0);

    await POSTPlayers(
      new Request("http://localhost/api/players", {
        method: "POST",
        body: JSON.stringify({ nickname: "NewPlayer" }),
      })
    );

    const getRes2 = await GET(
      new Request(`http://localhost/api/admin/state?key=${ADMIN_SECRET}`)
    );
    const after = await getRes2.json();
    expect(after.players).toHaveLength(1);
    expect(after.players[0].nickname).toBe("NewPlayer");
  });
});
