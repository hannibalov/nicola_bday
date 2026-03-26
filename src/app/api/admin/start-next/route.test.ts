/**
 * @jest-environment node
 */
import { POST } from "./route";
import { getSessionState, registerPlayer, resetSession } from "@/lib/store";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "admin-secret";

jest.mock("next/headers", () => ({
  headers: jest.fn(() => Promise.resolve({ get: () => null })),
}));

beforeEach(() => {
  resetSession();
});

describe("POST /api/admin/start-next", () => {
  it("returns 401 without admin key", async () => {
    const res = await POST(
      new Request("http://localhost/api/admin/start-next", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });

  it("advances guest step with key in query", async () => {
    registerPlayer("Alice");
    const res = await POST(
      new Request(
        `http://localhost/api/admin/start-next?key=${ADMIN_SECRET}`,
        { method: "POST" }
      )
    );
    expect(res.status).toBe(200);
    expect(getSessionState().guestStep).toBe("lobby_trivia");
    expect(getSessionState().revision).toBe(1);
  });

  it("accepts x-admin-key header", async () => {
    const { headers: headersFn } = await import("next/headers");
    (headersFn as jest.Mock).mockResolvedValueOnce({
      get: (name: string) => (name === "x-admin-key" ? ADMIN_SECRET : null),
    });
    registerPlayer("Zed");
    const res = await POST(
      new Request("http://localhost/api/admin/start-next", { method: "POST" })
    );
    expect(res.status).toBe(200);
    expect(getSessionState().guestStep).toBe("lobby_trivia");
  });
});
