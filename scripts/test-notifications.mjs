import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import webpush from "web-push";

// A separate PostgreSQL cluster and fixed test-only database; never use .env.
const directory = ".postgres/notification-tests";
mkdirSync(directory, { recursive: true });
const secretPath = `${directory}/secret`;
const password = existsSync(secretPath)
  ? readFileSync(secretPath, "utf8")
  : randomBytes(24).toString("hex");
if (!existsSync(secretPath))
  writeFileSync(secretPath, password, { mode: 0o600 });
const keys = webpush.generateVAPIDKeys();
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://buzz_notifications:${password}@127.0.0.1:54339/buzz_notifications_test`,
  APP_ORIGIN: "http://127.0.0.1:3102",
  BUZZ_TEST: "1",
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: "mailto:notification-tests@example.test",
  CRON_SECRET: randomBytes(32).toString("hex"),
  BUZZ_TEST_RECIPIENT_SESSION: randomBytes(32).toString("hex"),
  BUZZ_TEST_OTHER_SESSION: randomBytes(32).toString("hex"),
  BUZZ_TEST_ADMIN_SESSION: randomBytes(32).toString("hex"),
  BUZZ_TEST_CREATOR_SESSION: randomBytes(32).toString("hex"),
};
const pg = new EmbeddedPostgres({
  databaseDir: `${directory}/data`,
  user: "buzz_notifications",
  password,
  port: 54339,
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
// The package's exit hook calls stop again; make shutdown idempotent on Windows.
const stop = pg.stop.bind(pg);
let stopped = false;
pg.stop = async () => {
  if (stopped) return;
  stopped = true;
  if (process.platform !== "win32") return stop();
  const { pg_ctl } = await import("@embedded-postgres/windows-x64");
  await new Promise((resolve) => {
    const child = spawn(
      pg_ctl,
      ["stop", "-D", `${directory}/data`, "-m", "fast", "-w", "-t", "10"],
      { windowsHide: true, stdio: "ignore" },
    );
    child.on("error", resolve);
    child.on("exit", resolve);
  });
};
function run(file, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Test command exited with ${code}`)),
    );
  });
}
try {
  if (!existsSync(`${directory}/data/PG_VERSION`)) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = 'buzz_notifications_test'",
  );
  await client.end();
  if (!result.rowCount) await pg.createDatabase("buzz_notifications_test");
  // DATABASE_URL above is fixed to this dedicated test cluster.
  await run("node_modules/prisma/build/index.js", [
    "migrate",
    "reset",
    "--force",
    "--skip-seed",
    "--skip-generate",
  ]);
  await run("node_modules/tsx/dist/cli.mjs", [
    "tests/notification-fixtures.ts",
  ]);
  await run("node_modules/vitest/vitest.mjs", [
    "run",
    "--config",
    "vitest.notifications.config.ts",
  ]);
  if (!process.argv.includes("--integration-only"))
    await run("node_modules/@playwright/test/cli.js", [
      "test",
      "--config",
      "playwright.notifications.config.ts",
    ]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pg.stop().catch(() => {});
}
