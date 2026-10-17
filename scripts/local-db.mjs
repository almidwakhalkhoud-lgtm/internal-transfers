import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
mkdirSync(".postgres", { recursive: true });
const secretPath = ".postgres/local-secret";
const password = existsSync(secretPath)
  ? readFileSync(secretPath, "utf8")
  : randomBytes(32).toString("hex");
if (!existsSync(secretPath))
  writeFileSync(secretPath, password, { mode: 0o600 });
const pg = new EmbeddedPostgres({
  databaseDir: ".postgres/data",
  user: "buzz",
  password,
  port: 54329,
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(".postgres/data/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const result = await client.query(
  "SELECT 1 FROM pg_database WHERE datname = 'buzz'",
);
await client.end();
if (!result.rowCount) await pg.createDatabase("buzz");
if (!existsSync(".env"))
  writeFileSync(
    ".env",
    `DATABASE_URL=postgresql://buzz:${password}@127.0.0.1:54329/buzz\nAPP_ORIGIN=http://127.0.0.1:3100\n`,
    { mode: 0o600 },
  );
console.log(
  "Local PostgreSQL ready on 127.0.0.1:54329. Credentials remain in ignored local files.",
);
process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await pg.stop();
  process.exit(0);
});
setInterval(() => {}, 60000);
