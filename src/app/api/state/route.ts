import { NextResponse } from "next/server";
import { getPublicState } from "@/lib/store";
import { resolvePlayerIdFromRequest } from "@/lib/requestPlayer";

export async function GET(request: Request) {
  const playerId = resolvePlayerIdFromRequest(request);
  const state = getPublicState(playerId);
  return NextResponse.json(state);
}
