/**
 * @jest-environment node
 */
import { POST } from "./route";
import { getSessionState, registerPlayer, resetSession } from "@/lib/store";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "admin-secret";

jest.mock("next/headers", () => ({
  headers: jest.fn(() => Promise.resolve({ get: () => null })),
}));

// Mock Supabase
jest.mock("@/lib/supabase");

jest.setTimeout(30000);
jest.setTimeout(30000); beforeEach(async () => {
  await resetSession();
});

describe("POST /api/admin/start-next", () => {
  it("returns 401 without admin key", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/start-next", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });

  it("advances guest step with key in query", async () => {
    await registerPlayer("Alice");
    const res = await POST(
      new Request(
        `http://localhost/api/admin/start-next?key=${ADMIN_SECRET}`,
        { method: "POST" }
      )
    );
    expect(res.status).toBe(200);
    const state = await getSessionState();
    expect(state.guestStep).toBe("lobby_trivia");
    expect(state.revision).toBe(1);
  });

  it("accepts x-admin-key header", async () => {
    const { headers: headersFn } = await import("next/headers");
    (headersFn as jest.Mock).mockResolvedValueOnce({
      get: (name: string) => (name === "x-admin-key" ? ADMIN_SECRET : null),
    });
    await registerPlayer("Zed");
    const res = await POST(
      new Request("http://localhost/api/admin/start-next", { method: "POST" })
    );
    expect(res.status).toBe(200);
    expect((await getSessionState()).guestStep).toBe("lobby_trivia");
  });
});
