// Vercel build: generate the client, apply migrations when a database is
// configured, then build. Without DATABASE_URL the build still succeeds so
// the deployment shows the missing configuration instead of a build error.
import { spawnSync } from "node:child_process";
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status) process.exit(result.status);
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
  run([prisma, "migrate", "deploy"]);
}
run(["node_modules/next/dist/bin/next", "build"]);
