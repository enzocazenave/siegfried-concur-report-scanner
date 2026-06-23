import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionForApi } from "@/lib/auth";
import { buildScansExcelBuffer } from "@/lib/scan-export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * "Enviar": toma TODOS los informes pendientes (sin fecha de envío), les
 * estampa la fecha de envío (ahora) y devuelve el mismo Excel que la
 * exportación normal, pero conteniendo únicamente esos informes recién
 * enviados. Operación global: ignora los filtros de la pantalla.
 */
export async function POST() {
  const guard = await requireSessionForApi();
  if (guard instanceof NextResponse) return guard;

  // Tomamos los pendientes y los marcamos como enviados en una transacción,
  // para que el conteo del Excel coincida con lo que se marcó.
  const { sentScans, sentAt } = await prisma.$transaction(async (tx) => {
    const pending = await tx.scan.findMany({
      where: { sentAt: null },
      orderBy: { scanDate: "desc" },
    });

    if (pending.length === 0) {
      return { sentScans: pending, sentAt: null as Date | null };
    }

    const sentAt = new Date();
    await tx.scan.updateMany({
      where: { id: { in: pending.map((s) => s.id) } },
      data: { sentAt },
    });

    return { sentScans: pending, sentAt };
  });

  if (sentScans.length === 0) {
    return NextResponse.json(
      { error: "No hay informes pendientes de enviar." },
      { status: 409 }
    );
  }

  // Reflejamos la fecha de envío recién estampada en las filas del Excel.
  const buffer = buildScansExcelBuffer(
    sentScans.map((s) => ({ ...s, sentAt }))
  );
  const filename = `informes-enviados-${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Cantidad enviada, para que el cliente pueda mostrar un toast.
      "X-Sent-Count": String(sentScans.length),
    },
  });
}
