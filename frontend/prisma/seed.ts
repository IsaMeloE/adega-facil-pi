import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import prisma from "../src/lib/prisma.js";

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (existingAdmin) {
    console.log("Já existe um administrador. Nenhum usuário foi alterado.");
    return;
  }

  const pin = process.env.INITIAL_ADMIN_PIN;
  const name = process.env.INITIAL_ADMIN_NAME?.trim() || "Administrador";

  if (!pin || !/^\d{6}$/.test(pin)) {
    throw new Error("Informe um PIN inicial com exatamente 6 dígitos.");
  }

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  const pinHash = `scrypt$${salt}$${hash}`;

  await prisma.user.create({
    data: {
      name,
      pinHash,
      role: "ADMIN",
    },
  });

  console.log(`Administrador "${name}" criado.`);
}

main()
  .catch((error) => {
    console.error("Não foi possível criar o administrador:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });