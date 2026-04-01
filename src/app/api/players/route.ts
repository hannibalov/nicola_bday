import { NextResponse } from "next/server";
import { registerPlayer } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
    if (!nickname) {
      return NextResponse.json(
        { error: "nickname is required" },
        { status: 400 }
      );
    }
    const playerId = await registerPlayer(nickname);
    const res = NextResponse.json({ playerId });
    res.cookies.set("playerId", playerId, { path: "/", maxAge: 60 * 60 * 24 });
    return res;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
