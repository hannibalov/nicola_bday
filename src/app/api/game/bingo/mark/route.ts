import { NextResponse } from "next/server";
import { markBingoCell } from "@/lib/store";
import { resolvePlayerIdFromRequest } from "@/lib/requestPlayer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const playerId = resolvePlayerIdFromRequest(request);
  if (!playerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const cellIndex = body?.cellIndex;
    const markRaw = body?.mark;
    if (typeof cellIndex !== "number" || typeof markRaw !== "boolean") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const mark = markRaw;
    const result = markBingoCell(playerId, cellIndex, mark);
    if (!result.ok) {
      const status = result.error === "not_active" ? 400 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
