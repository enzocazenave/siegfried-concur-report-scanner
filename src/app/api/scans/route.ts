import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionForApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const guard = await requireSessionForApi();
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? 10))
  );
  const employeeId = searchParams.get("employeeId")?.trim() ?? "";
  const reportName = searchParams.get("reportName")?.trim() ?? "";
  const employeeName = searchParams.get("employeeName")?.trim() ?? "";
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
      Object.keys(dateFilter).length > 0 ? { scanDate: dateFilter } : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.scan.findMany({
      where,
      orderBy: { scanDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      // Include the username of whoever scanned this row — shown in the
      // history table but excluded from the Excel export.
      include: { user: { select: { username: true } } },
    }),
    prisma.scan.count({ where }),
  ]);

  const enriched = items.map((s) => ({
    id: s.id,
    scanDate: s.scanDate,
    reportName: s.reportName,
    employeeName: s.employeeName,
    employeeId: s.employeeId,
    sentAt: s.sentAt,
    createdAt: s.createdAt,
    username: s.user.username,
  }));

  return NextResponse.json({
    items: enriched,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireSessionForApi();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.reportName !== "string" ||
    typeof body.employeeId !== "string"
  ) {
    return NextResponse.json(
      { error: "reportName and employeeId are required strings" },
      { status: 400 }
    );
  }
  const reportName = body.reportName.trim();
  const employeeId = body.employeeId.trim();
  // employeeName is optional but typically present from OCR.
  const employeeName =
    typeof body.employeeName === "string"
      ? body.employeeName.trim() || null
      : null;
  const force = body.force === true;

  if (!reportName || !employeeId) {
    return NextResponse.json(
      { error: "reportName and employeeId cannot be empty" },
      { status: 400 }
    );
  }

  // Duplicate check: same employee + same report period already in DB?
  // The user can override with `force: true` after seeing the conflict.
  if (!force) {
    const existing = await prisma.scan.findFirst({
      where: { reportName, employeeId },
      orderBy: { scanDate: "desc" },
      include: { user: { select: { username: true } } },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "Este informe ya fue cargado.",
          existing: {
            id: existing.id,
            scanDate: existing.scanDate,
            reportName: existing.reportName,
            employeeName: existing.employeeName,
            employeeId: existing.employeeId,
            username: existing.user.username,
          },
        },
        { status: 409 }
      );
    }
  }

  const scan = await prisma.scan.create({
    data: { reportName, employeeName, employeeId, userId: guard.userId },
  });
  return NextResponse.json(scan, { status: 201 });
}
