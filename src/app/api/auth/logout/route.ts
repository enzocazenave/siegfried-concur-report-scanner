import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
