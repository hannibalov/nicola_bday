import { NextResponse } from "next/server";
import { claimBingo } from "@/lib/store";
import { resolvePlayerIdFromRequest } from "@/lib/requestPlayer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const playerId = resolvePlayerIdFromRequest(request);
  if (!playerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const lineKeys = Array.isArray(body?.lineKeys)
      ? body.lineKeys.filter((k: unknown): k is string => typeof k === "string")
      : [];
    const result = claimBingo(playerId, lineKeys);
    if (!result) {
      return NextResponse.json({ error: "Bingo not active" }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
