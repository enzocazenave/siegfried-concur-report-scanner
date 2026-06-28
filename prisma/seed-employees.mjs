/**
 * Carga / sincroniza el padrón de empleados desde un CSV al modelo Employee.
 *
 * Formato del CSV (separador ';', con encabezado):
 *   Equipo;Employee;Employee ID
 *   Fiori Diego (Siegfried);BROUSSON, EDUARDO JORGE;9900060005
 *
 * Idempotente: hace upsert por `employeeId`, así podés re-correrlo cuando
 * actualices el CSV. NO borra empleados que ya no estén en el archivo
 * (eso se hace a mano desde el ABM, para no perder datos por error).
 *
 * Uso:
 *   node prisma/seed-employees.mjs                       # usa prisma/data/codigos-concur.csv
 *   node prisma/seed-employees.mjs ruta/a/otro.csv       # otro archivo
 *
 * Apunta a la base que indique DATABASE_URL en el entorno. Para cargar Neon,
 * exportá su connection string antes de correrlo (ver README / instrucciones).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMPLOYEE_ID_RE = /^99000\d{5}$/;

function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // Saltar el encabezado.
    if (i === 0 && /employee\s*id/i.test(line)) continue;
    const parts = line.split(";");
    if (parts.length < 3) {
      console.warn(`Línea ${i + 1} ignorada (columnas insuficientes): ${line}`);
      continue;
    }
    const team = parts[0].trim();
    const employeeName = parts[1].trim();
    const employeeId = parts[2].trim();
    rows.push({ team, employeeName, employeeId, line: i + 1 });
  }
  return rows;
}

async function main() {
  const csvArg = process.argv[2];
  const csvPath = csvArg
    ? resolve(process.cwd(), csvArg)
    : resolve(__dirname, "data", "codigos-concur.csv");

  console.log(`Leyendo padrón desde: ${csvPath}`);
  const text = readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!EMPLOYEE_ID_RE.test(row.employeeId)) {
      console.warn(
        `Línea ${row.line} ignorada — código inválido "${row.employeeId}" (debe ser 99000 + 5 dígitos).`
      );
      skipped++;
      continue;
    }
    if (!row.employeeName || !row.team) {
      console.warn(
        `Línea ${row.line} ignorada — falta nombre o equipo (${row.employeeId}).`
      );
      skipped++;
      continue;
    }

    const existing = await prisma.employee.findUnique({
      where: { employeeId: row.employeeId },
      select: { id: true },
    });
    await prisma.employee.upsert({
      where: { employeeId: row.employeeId },
      create: {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        team: row.team,
      },
      update: {
        employeeName: row.employeeName,
        team: row.team,
      },
    });
    if (existing) updated++;
    else created++;
  }

  const total = await prisma.employee.count();
  console.log(
    `Listo. Creados: ${created}, actualizados: ${updated}, ignorados: ${skipped}. Total en la base: ${total}.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
