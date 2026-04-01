/**
 * @jest-environment node
 */
import { POST } from "./route";
import { resetSession } from "@/lib/store";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/supabase");

beforeEach(async () => {
  await resetSession();
});

describe("POST /api/players", () => {
  it("returns 400 when nickname is missing", async () => {
    const res = await POST(
      new Request("http://localhost/api/players", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("registers player and returns playerId with Set-Cookie", async () => {
    const res = await POST(
      new Request("http://localhost/api/players", {
        method: "POST",
        body: JSON.stringify({ nickname: "Alice" }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.playerId).toBeDefined();
    expect(typeof data.playerId).toBe("string");
    expect(res.headers.get("set-cookie")).toContain("playerId=");
  });
});
