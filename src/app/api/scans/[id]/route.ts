import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMasterForApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Solo el master puede eliminar escaneos. Los operadores comunes ven el
  // historial pero no pueden borrar entradas.
  const guard = await requireMasterForApi();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    await prisma.scan.delete({ where: { id: numericId } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    // Prisma "Record not found" → 404
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "El escaneo no existe." },
        { status: 404 }
      );
    }
    // eslint-disable-next-line no-console
    console.error("[/api/scans/:id DELETE]", err);
    return NextResponse.json(
      { error: "No se pudo eliminar el escaneo." },
      { status: 500 }
    );
  }
}
