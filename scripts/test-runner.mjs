import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
process.loadEnvFile(".env");
const db = new PrismaClient();
const exists = await db.$queryRawUnsafe(
  "SELECT 1 FROM pg_database WHERE datname='buzz_test'",
);
if (!exists.length)
  await db.$executeRawUnsafe(
    "CREATE DATABASE buzz_test WITH ENCODING 'UTF8' TEMPLATE template0",
  );
await db.$disconnect();
const url = new URL(process.env.DATABASE_URL);
url.pathname = "/buzz_test";
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  APP_ORIGIN: "http://127.0.0.1:3101",
  BUZZ_TEST_PASSWORD: randomBytes(24).toString("hex"),
  BUZZ_TEST_SETUP_TOKEN: randomBytes(32).toString("hex"),
  BUZZ_PRODUCTION_DATABASE_URL: process.env.DATABASE_URL,
};
mkdirSync(".postgres", { recursive: true });
writeFileSync(".postgres/test-setup-token", env.BUZZ_TEST_SETUP_TOKEN, {
  mode: 0o600,
});
let result = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "db",
    "push",
    "--skip-generate",
    "--accept-data-loss",
  ],
  { env, stdio: "inherit" },
);
if (result.status) process.exit(result.status);
result = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "db",
    "execute",
    "--file",
    "prisma/migrations/202610170002_document_guards/migration.sql",
    "--schema",
    "prisma/schema.prisma",
  ],
  { env, stdio: "inherit" },
);
if (result.status) process.exit(result.status);
result = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "db",
    "execute",
    "--file",
    "prisma/migrations/202610170003_employee_snapshot/migration.sql",
    "--schema",
    "prisma/schema.prisma",
  ],
  { env, stdio: "inherit" },
);
if (result.status) process.exit(result.status);
result = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "db",
    "execute",
    "--file",
    "prisma/migrations/202610170006_admin_transfer_delete/migration.sql",
    "--schema",
    "prisma/schema.prisma",
  ],
  { env, stdio: "inherit" },
);
if (result.status) process.exit(result.status);
result = spawnSync(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  { env, stdio: "inherit" },
);
process.exit(result.status ?? 1);
