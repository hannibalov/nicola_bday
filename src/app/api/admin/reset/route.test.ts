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

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "admin-secret";

jest.mock("next/headers", () => ({
  headers: jest.fn(() => Promise.resolve({ get: () => null })),
}));

// Mock Supabase to keep tests local and fast.
jest.mock("@/lib/supabase");

beforeEach(async () => {
  await resetSession();
});

describe("POST /api/admin/reset", () => {
  it("returns 401 without admin key", async () => {
    const res = await POST(new Request("http://localhost/api/admin/reset", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("clears players and guest step with key in query", async () => {
    await registerPlayer("Alice");
    await advancePhase();
    expect((await getSessionState()).players).toHaveLength(1);
    expect((await getSessionState()).guestStep).not.toBe("party_protocol");

    const res = await POST(
      new Request(`http://localhost/api/admin/reset?key=${ADMIN_SECRET}`, { method: "POST" })
    );
    expect(res.status).toBe(200);
    const state = await getSessionState();
    expect(state.players).toHaveLength(0);
    expect(state.guestStep).toBe("party_protocol");
    expect(state.revision).toBe(0);
  });

  it("accepts x-admin-key header", async () => {
    const { headers: headersFn } = await import("next/headers");
    (headersFn as jest.Mock).mockResolvedValueOnce({
      get: (name: string) => (name === "x-admin-key" ? ADMIN_SECRET : null),
    });
    await registerPlayer("Bob");
    const res = await POST(new Request("http://localhost/api/admin/reset", { method: "POST" }));
    expect(res.status).toBe(200);
    expect((await getSessionState()).players).toHaveLength(0);
  });
});
