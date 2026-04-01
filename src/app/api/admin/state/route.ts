import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSessionState } from "@/lib/store";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "admin-secret";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") ?? (await headers()).get("x-admin-key");
  if (key !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const state = await getSessionState();
  return NextResponse.json(state);
}
