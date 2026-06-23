import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMasterForApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireMasterForApi();
  if (guard instanceof NextResponse) return guard;

  const users = await prisma.user.findMany({
    orderBy: [{ isMaster: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      username: true,
      isMaster: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const guard = await requireMasterForApi();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const username =
    typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json(
      {
        error:
          "Usuario inválido. Usá 3-32 caracteres: letras, números, punto, guión o guión bajo.",
      },
      { status: 400 }
    );
  }
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres." },
      { status: 400 }
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, passwordHash, isMaster: false },
      select: { id: true, username: true, isMaster: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese nombre." },
        { status: 409 }
      );
    }
    // eslint-disable-next-line no-console
    console.error("[/api/admin/users POST]", err);
    return NextResponse.json(
      { error: "No se pudo crear el usuario." },
      { status: 500 }
    );
  }
}
