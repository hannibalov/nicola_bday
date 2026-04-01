/**
 * @jest-environment node
 */
import { GET } from "./route";
import { advancePhase, resetSession, registerPlayer } from "@/lib/store";

beforeEach(() => {
  resetSession();
});

describe("GET /api/events", () => {
  it("returns text/event-stream", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("stream yields initial session payload with guestStep and revision", async () => {
    const res = await GET();
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    const decoder = new TextDecoder();
    const { value, done } = await reader!.read();
    expect(done).toBe(false);
    const text = decoder.decode(value);
    expect(text).toContain("data:");
    expect(text).toContain("party_protocol");
    expect(text).toContain("revision");
    reader!.cancel();
  });

  it("initial SSE frame includes playerCount", async () => {
    registerPlayer("Alice");
    registerPlayer("Bob");
    const res = await GET();
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    const { value } = await reader!.read();
    const text = decoder.decode(value);
    const parsed = JSON.parse(text.replace(/^data: /, "").trim()) as Record<string, unknown>;
    expect(parsed.playerCount).toBe(2);
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

  it("SSE frame after player registers includes updated playerCount", async () => {
    const res = await GET();
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    await reader!.read(); // consume initial

    registerPlayer("NewPlayer");
    const { value } = await reader!.read();
    const text = decoder.decode(value);
    const parsed = JSON.parse(text.replace(/^data: /, "").trim()) as Record<string, unknown>;
    expect(parsed.playerCount).toBe(1);
    reader!.cancel();
  });
});
