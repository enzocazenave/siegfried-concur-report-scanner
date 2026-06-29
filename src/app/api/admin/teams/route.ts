import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMasterForApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lista de equipos distintos ya cargados en el padrón, ordenados alfabética-
 * mente. Alimenta el combobox de "Equipo" en el ABM de empleados.
 */
export async function GET() {
  const guard = await requireMasterForApi();
  if (guard instanceof NextResponse) return guard;

  const rows = await prisma.employee.findMany({
    distinct: ["team"],
    select: { team: true },
    orderBy: { team: "asc" },
  });
  const teams = rows.map((r) => r.team).filter(Boolean);

  return NextResponse.json({ teams });
}
