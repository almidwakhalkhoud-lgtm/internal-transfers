// Vercel build: generate the client, apply migrations when a database is
// configured, then build. Without DATABASE_URL the build still succeeds so
// the deployment shows the missing configuration instead of a build error.
import { spawnSync } from "node:child_process";
function attempt(args, env = process.env) {
  return spawnSync(process.execPath, args, { stdio: "inherit", env }).status;
}
function run(args, env) {
  const status = attempt(args, env);
  if (status) process.exit(status);
}
// Migrations hold a session advisory lock, which can hang behind Neon's
// transaction-mode pooler. Migrate over DIRECT_URL, or Neon's direct host
// (the pooled host without "-pooler"); the app keeps using the pooler.
function migrationUrl(value) {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  try {
    const url = new URL(value);
    if (url.hostname.endsWith(".neon.tech"))
      url.hostname = url.hostname.replace("-pooler.", ".");
    return url.toString();
  } catch {
    return value;
  }
}
const prisma = "node_modules/prisma/build/index.js";
const env = { ...process.env };
if (!env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set: skipping migrations. Set it in Vercel → Settings → Environment Variables and redeploy.",
  );
  // Prisma validates the schema even for generate; a placeholder is enough.
  process.env.DATABASE_URL = "postgresql://unset@localhost:5432/unset";
  run([prisma, "generate"]);
} else {
  run([prisma, "generate"]);
  const migrateEnv = { ...env, DATABASE_URL: migrationUrl(env.DATABASE_URL) };
  // An overlapping deployment may hold the migration lock for a moment.
  let status = 1;
  for (let i = 0; i < 3 && status; i++) {
    if (i) await new Promise((done) => setTimeout(done, 15000));
    status = attempt([prisma, "migrate", "deploy"], migrateEnv);
  }
  if (status) process.exit(status);
}
run(["node_modules/next/dist/bin/next", "build"]);
