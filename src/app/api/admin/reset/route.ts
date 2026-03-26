import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { resetSession } from "@/lib/store";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "admin-secret";

export async function POST(request: Request) {
  const key =
    new URL(request.url).searchParams.get("key") ??
    (await headers()).get("x-admin-key");
  if (key !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  resetSession();
  return NextResponse.json({ ok: true });
}
