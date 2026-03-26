/**
 * @jest-environment node
 */
import { GET } from "./route";
import { advancePhase, resetSession } from "@/lib/store";

beforeEach(() => {
  resetSession();
});

describe("GET /api/events", () => {
  it("returns text/event-stream", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("stream yields initial session payload", async () => {
    const res = await GET();
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    const decoder = new TextDecoder();
    const { value, done } = await reader!.read();
    expect(done).toBe(false);
    const text = decoder.decode(value);
    expect(text).toContain("data:");
    expect(text).toContain("party_protocol");
    reader!.cancel();
  });

  it("pushes updated guestStep after session notify", async () => {
    const res = await GET();
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    await reader!.read();
    advancePhase();
    const second = await reader!.read();
    expect(second.done).toBe(false);
    expect(decoder.decode(second.value)).toContain("lobby_trivia");
    reader!.cancel();
  });
});
