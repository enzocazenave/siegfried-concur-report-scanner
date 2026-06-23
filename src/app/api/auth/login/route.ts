import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setSession } from "@/lib/session";
import {
  checkLoginRateLimit,
  getClientIp,
  recordLoginAttempt,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = await getClientIp();
  const limit = await checkLoginRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: `Demasiados intentos fallidos. Probá de nuevo en ${Math.ceil(
          limit.retryAfterSeconds / 60
        )} minuto(s).`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  const body = await req.json().catch(() => null);
  const username =
    typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Usuario y contraseña son obligatorios." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { username } });
  // Constant-ish path on user-not-found to avoid timing oracles.
  const passwordOk = user
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(
        password,
        "$2a$10$invalidinvalidinvalidinvalidinvalid"
      );

  const success = !!user && passwordOk;
  await recordLoginAttempt(ip, success);

  if (!success) {
    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos." },
      { status: 401 }
    );
  }

  await setSession({
    userId: user!.id,
    username: user!.username,
    isMaster: user!.isMaster,
  });

  return NextResponse.json({
    id: user!.id,
    username: user!.username,
    isMaster: user!.isMaster,
  });
}
