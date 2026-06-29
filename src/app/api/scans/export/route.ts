import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionForApi } from "@/lib/auth";
import { buildScansExcelBuffer } from "@/lib/scan-export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  // NOTE: The Excel file intentionally OMITS the user who scanned each row.
  // Authentication is still required to download (no anonymous exports), but
  // the spreadsheet itself only contains the three business columns.
  const guard = await requireSessionForApi();
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId")?.trim() ?? "";
  const reportName = searchParams.get("reportName")?.trim() ?? "";
  const employeeName = searchParams.get("employeeName")?.trim() ?? "";
  const team = searchParams.get("team")?.trim() ?? "";
  const from = parseIsoDate(searchParams.get("from"));
  const to = parseIsoDate(searchParams.get("to"));

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = from;
  if (to) dateFilter.lte = to;

  const where = {
    AND: [
      employeeId ? { employeeId: { contains: employeeId } } : {},
      reportName ? { reportName: { contains: reportName } } : {},
      employeeName ? { employeeName: { contains: employeeName } } : {},
      team ? { team: { contains: team } } : {},
      Object.keys(dateFilter).length > 0 ? { scanDate: dateFilter } : {},
    ],
  };

  const scans = await prisma.scan.findMany({
    where,
    orderBy: { scanDate: "desc" },
  });

  const buffer = buildScansExcelBuffer(scans);
  const filename = `escaneos-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
