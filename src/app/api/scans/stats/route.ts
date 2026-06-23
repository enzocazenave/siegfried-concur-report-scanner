import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionForApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Estadísticas globales (sin filtros) del historial de informes:
 *   - total:   informes escaneados
 *   - sent:    informes ya enviados (con fecha de envío)
 *   - pending: informes pendientes de enviar (sin fecha de envío)
 */
export async function GET() {
  const guard = await requireSessionForApi();
  if (guard instanceof NextResponse) return guard;

  const [total, pending] = await Promise.all([
    prisma.scan.count(),
    prisma.scan.count({ where: { sentAt: null } }),
  ]);

  return NextResponse.json({
    total,
    sent: total - pending,
    pending,
  });
}
