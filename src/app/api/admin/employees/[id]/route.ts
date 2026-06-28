import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMasterForApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMPLOYEE_ID_RE = /^99000\d{5}$/;

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
  const employeeId =
    typeof body?.employeeId === "string" ? body.employeeId.trim() : "";
  const employeeName =
    typeof body?.employeeName === "string" ? body.employeeName.trim() : "";
  const team = typeof body?.team === "string" ? body.team.trim() : "";

  if (!EMPLOYEE_ID_RE.test(employeeId)) {
    return NextResponse.json(
      { error: "El código debe empezar con 99000 y tener 10 dígitos en total." },
      { status: 400 }
    );
  }
  if (!employeeName) {
    return NextResponse.json(
      { error: "El nombre del empleado es obligatorio." },
      { status: 400 }
    );
  }
  if (!team) {
    return NextResponse.json(
      { error: "El equipo es obligatorio." },
      { status: 400 }
    );
  }

  try {
    const employee = await prisma.employee.update({
      where: { id: numericId },
      data: { employeeId, employeeName, team },
    });
    return NextResponse.json(employee);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json(
          { error: "El empleado no existe." },
          { status: 404 }
        );
      }
      if (err.code === "P2002") {
        return NextResponse.json(
          { error: "Ya existe otro empleado con ese código." },
          { status: 409 }
        );
      }
    }
    // eslint-disable-next-line no-console
    console.error("[/api/admin/employees/:id PATCH]", err);
    return NextResponse.json(
      { error: "No se pudo actualizar el empleado." },
      { status: 500 }
    );
  }
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

  try {
    await prisma.employee.delete({ where: { id: numericId } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "El empleado no existe." },
        { status: 404 }
      );
    }
    // eslint-disable-next-line no-console
    console.error("[/api/admin/employees/:id DELETE]", err);
    return NextResponse.json(
      { error: "No se pudo eliminar el empleado." },
      { status: 500 }
    );
  }
}
