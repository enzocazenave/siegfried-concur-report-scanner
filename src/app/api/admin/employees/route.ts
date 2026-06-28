import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMasterForApi } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Mismo formato que valida el scanner: "99000" + 5 dígitos.
const EMPLOYEE_ID_RE = /^99000\d{5}$/;

export async function GET(req: NextRequest) {
  const guard = await requireMasterForApi();
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? 15))
  );
  const q = searchParams.get("q")?.trim() ?? "";

  const where: Prisma.EmployeeWhereInput = q
    ? {
        OR: [
          { employeeName: { contains: q, mode: "insensitive" } },
          { employeeId: { contains: q } },
          { team: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { employeeName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireMasterForApi();
  if (guard instanceof NextResponse) return guard;

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
    const employee = await prisma.employee.create({
      data: { employeeId, employeeName, team },
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ya existe un empleado con ese código." },
        { status: 409 }
      );
    }
    // eslint-disable-next-line no-console
    console.error("[/api/admin/employees POST]", err);
    return NextResponse.json(
      { error: "No se pudo crear el empleado." },
      { status: 500 }
    );
  }
}
