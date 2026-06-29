import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMasterForApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Mismas reglas que el scanner: período MM/YYYY y código 99000 + 5 dígitos.
const REPORT_NAME_RE = /^(0[1-9]|1[0-2])\/\d{4}$/;
const EMPLOYEE_ID_RE = /^99000\d{5}$/;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Solo el master puede editar escaneos (corrección de errores/accidentes).
  const guard = await requireMasterForApi();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const reportName =
    typeof body?.reportName === "string" ? body.reportName.trim() : "";
  const employeeId =
    typeof body?.employeeId === "string" ? body.employeeId.trim() : "";

  if (!REPORT_NAME_RE.test(reportName)) {
    return NextResponse.json(
      { error: "El nombre del informe debe tener el formato MM/YYYY." },
      { status: 400 }
    );
  }
  if (!EMPLOYEE_ID_RE.test(employeeId)) {
    return NextResponse.json(
      { error: "El código debe empezar con 99000 y tener 10 dígitos en total." },
      { status: 400 }
    );
  }

  // El código debe existir en el padrón; de ahí salen el nombre y el equipo.
  const employee = await prisma.employee.findUnique({
    where: { employeeId },
    select: { employeeName: true, team: true },
  });
  if (!employee) {
    return NextResponse.json(
      {
        error:
          "El identificador no corresponde a ningún empleado del padrón.",
      },
      { status: 422 }
    );
  }

  // Evitar que la edición genere un duplicado exacto de OTRO escaneo.
  const dup = await prisma.scan.findFirst({
    where: { reportName, employeeId, id: { not: numericId } },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json(
      { error: "Ya existe otro escaneo con ese informe y empleado." },
      { status: 409 }
    );
  }

  try {
    const scan = await prisma.scan.update({
      where: { id: numericId },
      data: {
        reportName,
        employeeId,
        employeeName: employee.employeeName,
        team: employee.team,
      },
    });
    return NextResponse.json(scan);
  } catch (err) {
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
    console.error("[/api/scans/:id PATCH]", err);
    return NextResponse.json(
      { error: "No se pudo actualizar el escaneo." },
      { status: 500 }
    );
  }
}

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
