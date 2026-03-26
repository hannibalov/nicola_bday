import { NextResponse } from "next/server";

/** Clears httpOnly `playerId` so the guest can register again after a host session reset. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("playerId", "", { path: "/", maxAge: 0 });
  return res;
}
