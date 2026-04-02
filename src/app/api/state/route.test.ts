/**
 * @jest-environment node
 */
import { GET } from "./route";
import { resetSession, registerPlayer } from "@/lib/store";
import { NICOLA_PLAYER_ID_HEADER } from "@/lib/requestPlayer";
import { resetTestTables } from "@/lib/supabase";

jest.setTimeout(30000);
jest.setTimeout(30000); beforeEach(async () => {
  resetTestTables();
  await resetSession();
});

function stateReq(init?: RequestInit): Request {
  return new Request("http://localhost/api/state", init);
}

describe("GET /api/state", () => {
  it("returns public state with party_protocol when no playerId cookie", async () => {
    const res = await GET(stateReq());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.guestStep).toBe("party_protocol");
    expect(data.revision).toBe(0);
    expect(data.currentGameIndex).toBeDefined();
    expect(data.games).toBeDefined();
  });

  it("returns public state with playerId from cookie", async () => {
    const id = await registerPlayer("Bob");
    const res = await GET(
      stateReq({
        headers: { Cookie: `playerId=${encodeURIComponent(id)}` },
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.guestStep).toBe("party_protocol");
    expect(data.playerKnownToSession).toBe(true);
  });

  it("under NODE_ENV=test prefers x-nicola-player-id over cookie", async () => {
    const id1 = await registerPlayer("Z_cookie");
    const id2 = await registerPlayer("Z_header");
    const res = await GET(
      stateReq({
        headers: {
          Cookie: `playerId=${encodeURIComponent(id1)}`,
          [NICOLA_PLAYER_ID_HEADER]: id2,
        },
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.playerKnownToSession).toBe(true);
  });

  it("playerKnownToSession false when cookie survives host reset", async () => {
    const id = await registerPlayer("Zed");
    let res = await GET(
      stateReq({
        headers: { Cookie: `playerId=${encodeURIComponent(id)}` },
      }),
    );
    let data = await res.json();
    expect(data.playerKnownToSession).toBe(true);

    await resetSession();
    res = await GET(
      stateReq({
        headers: { Cookie: `playerId=${encodeURIComponent(id)}` },
      }),
    );
    data = await res.json();
    expect(data.playerKnownToSession).toBe(false);
    expect(data.playerCount).toBe(0);
  });
});
