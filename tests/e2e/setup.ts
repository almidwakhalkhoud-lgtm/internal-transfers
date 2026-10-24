import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
export default async function setup() {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.pathname !== "/buzz_test")
    throw new Error("Tests only run against buzz_test");
  const db = new PrismaClient();
  // The reset is confined to a fixed, dedicated test database.
  await db.$executeRawUnsafe(
    'TRUNCATE "Session", "LoginAttempt", "StockRequest", "Transfer", "Draft", "Audit", "CatalogConflict", "Barcode", "Product", "_LocationToUser", "Location", "User", "Sequence", "RequestDraft" CASCADE',
  );
  // The required-notifications prompt would cover every page; the test that
  // checks it turns it on for itself.
  await db.notificationSettings.upsert({
    where: { id: "global" },
    create: { id: "global", requireDevice: false },
    update: { requireDevice: false },
  });
  const source = new PrismaClient({
    datasourceUrl: process.env.BUZZ_PRODUCTION_DATABASE_URL,
  });
  const realWithUnit = await source.product.findFirstOrThrow({
    where: { NOT: { units: { isEmpty: true } } },
    orderBy: { code: "asc" },
    include: { barcodes: true },
  });
  const realNoUnit = await source.product.findFirstOrThrow({
    where: { units: { isEmpty: true } },
    orderBy: { code: "asc" },
    include: { barcodes: true },
  });
  for (const p of [realWithUnit, realNoUnit])
    await db.product.create({
      data: {
        id: p.units.length ? "real-unit" : "real-no-unit",
        code: p.code,
        description: p.description,
        units: p.units,
        source: p.source,
      },
    });
  await source.$disconnect();
  // Explicit test fixtures exercise barcode edge cases; never inserted into the application database.
  await db.product.create({
    data: {
      id: "fixture-barcode",
      code: "TEST-001",
      description: "TEST FIXTURE · Barcode leading-zero test",
      units: ["box", "piece"],
      source: "AUTOMATED TEST FIXTURE",
      barcodes: {
        create: [{ value: "0012300119139" }, { value: "0098765432105" }],
      },
    },
  });
  await db.location.createMany({
    data: [
      { id: "main", name: "Main" },
      { id: "branch", name: "Al Azaiba" },
      { id: "restricted", name: "TEST RESTRICTED LOCATION" },
    ],
  });
  const password = await bcrypt.hash(process.env.BUZZ_TEST_PASSWORD!, 12);
  // Exercise the real one-time provisioning endpoint in the isolated test environment.
  const provision = await fetch("http://127.0.0.1:3101/api/setup", {
    method: "POST",
    headers: {
      Origin: "http://127.0.0.1:3101",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: process.env.BUZZ_TEST_SETUP_TOKEN,
      name: "QA Administrator",
      email: "admin@buzz.test",
      password: process.env.BUZZ_TEST_PASSWORD,
    }),
  });
  if (!provision.ok) throw new Error("Test administrator provisioning failed");
  await db.user.create({
    data: {
      id: "test-staff",
      accessHash: createHash("sha256")
        .update(
          "BUZZ-" +
            Buffer.from(process.env.BUZZ_TEST_PASSWORD!)
              .subarray(0, 32)
              .toString("base64url"),
        )
        .digest("hex"),
      name: "QA Staff",
      email: "staff@buzz.test",
      password,
      role: "STAFF",
      locations: { connect: [{ id: "main" }, { id: "branch" }] },
    },
  });
  await db.user.create({
    data: {
      id: "test-outsider",
      accessHash: createHash("sha256")
        .update(
          "BUZZ-" +
            Buffer.from(process.env.BUZZ_TEST_PASSWORD! + "outside")
              .subarray(-32)
              .toString("base64url"),
        )
        .digest("hex"),
      name: "QA Outside",
      email: "outside@buzz.test",
      password,
      role: "STAFF",
      locations: { connect: [{ id: "restricted" }] },
    },
  });
  await db.$disconnect();
}
