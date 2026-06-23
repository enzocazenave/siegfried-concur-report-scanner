/**
 * Bootstrap the master user from env vars on first run.
 *
 *   INITIAL_MASTER_USERNAME (default: "admin")
 *   INITIAL_MASTER_PASSWORD (required, ≥ 8 chars)
 *
 * Idempotent: if any user already exists, the script is a no-op.
 *
 * Run automatically by `npm run db:seed`, or manually after wiping the DB:
 *   npx prisma db push && node prisma/seed.mjs
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username =
    (process.env.INITIAL_MASTER_USERNAME ?? "admin").trim() || "admin";
  const password = process.env.INITIAL_MASTER_PASSWORD;

  if (!password || password.length < 8) {
    console.error(
      "ERROR: Falta INITIAL_MASTER_PASSWORD en el entorno (mínimo 8 caracteres). " +
        "Definila en .env y volvé a correr el seed."
    );
    process.exit(1);
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(
      `Ya existen ${userCount} usuario(s) — no se crea master. Si querés regenerarlo, primero borrá la tabla User.`
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const master = await prisma.user.create({
    data: { username, passwordHash, isMaster: true },
  });
  console.log(`Master creado: id=${master.id} username='${master.username}'.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
