import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionForApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Verifica que un identificador corresponda a un empleado real del padrón.
 * Lo usa el scanner para validar el código leído por Claude antes de permitir
 * confirmar. Disponible para cualquier usuario autenticado (no solo maestro).
 *
 *   GET /api/employees/lookup?employeeId=9900060005
 *   -> { found: true, employee: { employeeId, employeeName, team } }
 *   -> { found: false }
 */
export async function GET(req: NextRequest) {
  const guard = await requireSessionForApi();
  if (guard instanceof NextResponse) return guard;

  const employeeId = req.nextUrl.searchParams.get("employeeId")?.trim() ?? "";
  if (!employeeId) {
    return NextResponse.json(
      { error: "Falta el parámetro employeeId." },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { employeeId },
    select: { employeeId: true, employeeName: true, team: true },
  });

  return NextResponse.json(
    employee ? { found: true, employee } : { found: false }
  );
}
