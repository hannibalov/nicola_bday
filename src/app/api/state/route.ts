import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPublicState } from "@/lib/store";

export async function GET() {
  const cookieStore = await cookies();
  const playerId = cookieStore.get("playerId")?.value ?? null;
  const state = getPublicState(playerId);
  return NextResponse.json(state);
}
