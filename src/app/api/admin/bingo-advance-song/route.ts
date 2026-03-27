import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { adminAdvanceBingoSong } from "@/lib/store";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "admin-secret";

export const dynamic = "force-dynamic";

export async function POST() {
  const key = (await headers()).get("x-admin-key");
  if (key !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = adminAdvanceBingoSong();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
