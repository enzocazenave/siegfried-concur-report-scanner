import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionForApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CellStatus = "missing" | "scanned" | "sent";

const MONTHS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
];

/**
 * Estado de informes por equipo: matriz empleado × mes para un año dado.
 * Cada celda es "missing" (no escaneado), "scanned" (cargado, sin enviar) o
 * "sent" (con fecha de envío). El informe de un empleado para el mes MM del
 * año AAAA es un Scan con reportName = "MM/AAAA".
 *
 * Disponible para cualquier usuario autenticado (vista de solo lectura).
 */
export async function GET(req: NextRequest) {
  const guard = await requireSessionForApi();
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);

  // Equipos distintos del padrón (para el selector).
  const teamRows = await prisma.employee.findMany({
    distinct: ["team"],
    select: { team: true },
    orderBy: { team: "asc" },
  });
  const teams = teamRows.map((r) => r.team).filter(Boolean);

  // Años disponibles: los que aparecen en los informes + el año actual.
  const reportRows = await prisma.scan.findMany({
    distinct: ["reportName"],
    select: { reportName: true },
  });
  const yearSet = new Set<number>();
  for (const r of reportRows) {
    const m = /^\d{2}\/(\d{4})$/.exec(r.reportName);
    if (m) yearSet.add(Number(m[1]));
  }
  const currentYear = new Date().getFullYear();
  yearSet.add(currentYear);
  const years = [...yearSet].sort((a, b) => b - a);

  // Selección. team vacío = TODOS los equipos (agrupados).
  const team = searchParams.get("team")?.trim() ?? "";
  const yearParam = Number(searchParams.get("year"));
  const year =
    Number.isInteger(yearParam) && yearParam > 0 ? yearParam : currentYear;

  // Roster: el equipo filtrado, o todos ordenados por equipo y nombre.
  const roster = await prisma.employee.findMany({
    where: team ? { team } : {},
    select: { employeeId: true, employeeName: true, team: true },
    orderBy: team
      ? [{ employeeName: "asc" }]
      : [{ team: "asc" }, { employeeName: "asc" }],
  });
  const ids = roster.map((e) => e.employeeId);

  const scans = ids.length
    ? await prisma.scan.findMany({
        where: {
          employeeId: { in: ids },
          reportName: { endsWith: `/${year}` },
        },
        select: { employeeId: true, reportName: true, sentAt: true },
      })
    : [];

  // employeeId -> { MM -> status }
  const map = new Map<string, Record<string, CellStatus>>();
  for (const s of scans) {
    const m = /^(\d{2})\/\d{4}$/.exec(s.reportName);
    if (!m) continue;
    const month = m[1];
    const cur = map.get(s.employeeId) ?? {};
    const status: CellStatus = s.sentAt ? "sent" : "scanned";
    // "sent" gana por si hubiera más de un escaneo para el mismo mes.
    if (cur[month] !== "sent") cur[month] = status;
    map.set(s.employeeId, cur);
  }

  const employees = roster.map((e) => {
    const found = map.get(e.employeeId) ?? {};
    const months: Record<string, CellStatus> = {};
    for (const mm of MONTHS) months[mm] = found[mm] ?? "missing";
    return {
      employeeId: e.employeeId,
      employeeName: e.employeeName,
      team: e.team,
      months,
    };
  });

  return NextResponse.json({ teams, years, team, year, employees });
}
