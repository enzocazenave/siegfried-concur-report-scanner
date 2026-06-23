import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMasterForApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireMasterForApi();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "La nueva contraseña debe tener al menos 6 caracteres." },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: numericId },
    select: { id: true, username: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: "El usuario no existe." },
      { status: 404 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: numericId },
    data: { passwordHash },
  });
  return NextResponse.json({
    id: target.id,
    username: target.username,
    passwordChanged: true,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireMasterForApi();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  if (numericId === guard.userId) {
    return NextResponse.json(
      { error: "No podés eliminar tu propio usuario." },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: numericId },
    select: { isMaster: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: "El usuario no existe." },
      { status: 404 }
    );
  }
  if (target.isMaster) {
    return NextResponse.json(
      { error: "No se puede eliminar al usuario maestro." },
      { status: 400 }
    );
  }

  try {
    // We refuse to delete users that have scans, to preserve audit history.
    // The master can wipe the scans first if they really need to remove them.
    const scanCount = await prisma.scan.count({ where: { userId: numericId } });
    if (scanCount > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: el usuario tiene ${scanCount} escaneo(s). Eliminá esos escaneos primero o desactivá el usuario (TODO).`,
        },
        { status: 400 }
      );
    }
    await prisma.user.delete({ where: { id: numericId } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "El usuario no existe." },
        { status: 404 }
      );
    }
    // eslint-disable-next-line no-console
    console.error("[/api/admin/users/:id DELETE]", err);
    return NextResponse.json(
      { error: "No se pudo eliminar el usuario." },
      { status: 500 }
    );
  }
}
