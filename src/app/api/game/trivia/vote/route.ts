import { NextResponse } from "next/server";
import { submitTriviaVote } from "@/lib/store";
import { resolvePlayerIdFromRequest } from "@/lib/requestPlayer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const playerId = resolvePlayerIdFromRequest(request);
  if (!playerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const questionId =
      typeof body?.questionId === "string" ? body.questionId : null;
    const optionIndex = body?.optionIndex;
    if (questionId == null || typeof optionIndex !== "number") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const result = await submitTriviaVote(playerId, questionId, optionIndex);
    if (!result.ok) {
      const status =
        result.error === "not_active"
          ? 400
          : result.error === "unknown_player"
            ? 403
            : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
