import crypto from "crypto";
import bcrypt from "bcryptjs";
import { MANUAL_SERVICE_DEFINITIONS, SERVICE_DEFINITIONS } from "@barberbook/shared";
import { prisma } from "../src";

async function main() {
  for (const service of SERVICE_DEFINITIONS) {
    await prisma.service.upsert({
      where: { name: service.name },
      update: { duration_minutes: service.duration_minutes, is_child_service: service.is_child_service },
      create: service,
    });
  }
  for (const service of MANUAL_SERVICE_DEFINITIONS) {
    await prisma.service.upsert({
      where: { name: service.name },
      update: { duration_minutes: service.duration_minutes, is_manual_only: true },
      create: service,
    });
  }

  // The barber's display name — change this and re-run `pnpm db:seed` to hand
  // the system to a different barber (see CLAUDE.md, "שם מנהל המערכת").
  const ADMIN_FULL_NAME = "יוסי הספר";
  const adminPhone = "0500000000";

  // Only the `create` branch ever sets the password — re-seeding an existing
  // admin never touches password_hash — so a fixed literal here would be a
  // permanent, known credential. Use ADMIN_SEED_PASSWORD if the operator
  // supplied one, otherwise generate a random one-time password.
  const existingAdmin = await prisma.user.findUnique({ where: { phone_number: adminPhone } });
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? crypto.randomBytes(9).toString("base64url");

  await prisma.user.upsert({
    where: { phone_number: adminPhone },
    update: { full_name: ADMIN_FULL_NAME },
    create: {
      full_name: ADMIN_FULL_NAME,
      phone_number: adminPhone,
      password_hash: await bcrypt.hash(adminPassword, 10),
      role: "administrator",
    },
  });
  console.log(`Seeded/updated admin user: phone=${adminPhone}`);

  // The primary Barber row — distinct from the admin User account above
  // (login vs. calendar identity), but keyed to the same display name. See
  // CLAUDE.md, "ספרי משנה": sub-barbers (is_primary: false) are added via
  // /admin/barbers and never seeded here.
  await prisma.barber.upsert({
    where: { id: "primary" },
    update: { full_name: ADMIN_FULL_NAME },
    create: { id: "primary", full_name: ADMIN_FULL_NAME, is_primary: true },
  });

  if (!existingAdmin) {
    if (process.env.ADMIN_SEED_PASSWORD) {
      console.log("Admin password set from ADMIN_SEED_PASSWORD.");
    } else {
      console.log(`Generated admin password (shown once — save it now): ${adminPassword}`);
      console.log(
        "Set ADMIN_SEED_PASSWORD in .env before seeding a fresh DB to choose your own password instead.",
      );
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
