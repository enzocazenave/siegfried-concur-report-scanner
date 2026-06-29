/**
 * Backfill del equipo (y, opcionalmente, del nombre) en escaneos viejos.
 *
 * Los escaneos cargados ANTES del padrón quedaron con `team` en NULL. Este
 * script cruza cada uno contra el padrón de empleados por `employeeId` y
 * completa el equipo. Idempotente: solo toca escaneos con team = NULL, así
 * que podés re-correrlo sin miedo.
 *
 * Por defecto SOLO completa el equipo. Si además querés corregir el nombre
 * mal leído por Claude usando el nombre oficial del padrón, corré con
 * FIX_NAMES=1 (recomendado para dejar todo consistente).
 *
 * Apunta a la base que indique DATABASE_URL. Para producción, exportá la
 * connection string de Neon antes de correrlo (ver instrucciones).
 *
 * Uso:
 *   node prisma/backfill-scan-teams.mjs
 *   FIX_NAMES=1 node prisma/backfill-scan-teams.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FIX_NAMES = process.env.FIX_NAMES === "1";

async function main() {
  const employees = await prisma.employee.findMany({
    select: { employeeId: true, employeeName: true, team: true },
  });
  if (employees.length === 0) {
    console.error(
      "El padrón está vacío. Cargá los empleados primero (node prisma/seed-employees.mjs) y volvé a correr este backfill."
    );
    process.exit(1);
  }
  const byId = new Map(employees.map((e) => [e.employeeId, e]));

  const scans = await prisma.scan.findMany({
    where: { team: null },
    select: { id: true, employeeId: true },
  });
  console.log(
    `Escaneos sin equipo: ${scans.length}. Padrón: ${employees.length} empleados. FIX_NAMES=${FIX_NAMES ? "sí" : "no"}.`
  );

  let updated = 0;
  const unmatched = [];
  for (const s of scans) {
    const emp = byId.get(s.employeeId.trim());
    if (!emp) {
      unmatched.push(s.employeeId);
      continue;
    }
    await prisma.scan.update({
      where: { id: s.id },
      data: {
        team: emp.team,
        ...(FIX_NAMES ? { employeeName: emp.employeeName } : {}),
      },
    });
    updated++;
  }

  console.log(`Actualizados: ${updated}.`);
  if (unmatched.length > 0) {
    const unique = [...new Set(unmatched)];
    console.log(
      `Sin coincidencia en el padrón: ${unmatched.length} escaneo(s), ${unique.length} código(s) distinto(s).`
    );
    console.log("Códigos a revisar a mano:");
    console.log(unique.join(", "));
  } else {
    console.log("Todos los escaneos cruzaron con el padrón. 🎉");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
