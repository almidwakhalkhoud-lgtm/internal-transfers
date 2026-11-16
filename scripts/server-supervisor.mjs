import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, renameSync, statSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";

// This entry point intentionally refuses to initialise or copy a database.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const config = JSON.parse(readFileSync(".postgres/server-config.json", "utf8").replace(/^\uFEFF/, ""));
const env = { ...process.env, ...parseEnv(readFileSync(".env", "utf8")), NODE_ENV: "production", PLAYWRIGHT_BROWSERS_PATH: config.browserPath };
delete env.TARGET_DATABASE_URL;
delete env.VERCEL;
const database = new URL(env.DATABASE_URL);
if (database.hostname !== "127.0.0.1" || database.port !== "54329") throw new Error("Server requires the existing local PostgreSQL database on port 54329.");
for (const required of [".postgres/data/PG_VERSION", ".postgres/access-code-pepper", ".next/BUILD_ID", config.tunnelConfig]) {
  if (!existsSync(required)) throw new Error(`Required server file is missing: ${required}`);
}
const logs = path.join(root, "output/server");
mkdirSync(logs, { recursive: true });
const lock = path.join(logs, "supervisor.lock");
let previousOwner;
try { mkdirSync(lock); } catch (error) {
  if (error.code !== "EEXIST") throw error;
  const pid = Number(readFileSync(path.join(lock, "pid"), "utf8"));
  let alive = false;
  try { process.kill(pid, 0); alive = true; } catch (e) { if (e.code !== "ESRCH") throw e; }
  if (alive) throw new Error("The BUZZ supervisor is already running.");
  previousOwner = pid;
}
writeFileSync(path.join(lock, "pid"), String(process.pid));
// A forced supervisor exit can leave children alive. Only reclaim recorded
// children whose OS parent matches that dead supervisor, never unrelated apps.
if (previousOwner && existsSync(path.join(logs, "status.json"))) {
  const previous = JSON.parse(readFileSync(path.join(logs, "status.json"), "utf8"));
  if (previous.pid === previousOwner && previous.processes) {
    const recorded = new Set(Object.values(previous.processes));
    const output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Get-CimInstance Win32_Process -Filter 'ParentProcessId = ${previousOwner}' | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress`], { encoding: "utf8", windowsHide: true });
    const found = output.trim() ? JSON.parse(output) : [];
    for (const child of Array.isArray(found) ? found : [found]) {
      if (recorded.has(child.ProcessId) && child.ParentProcessId === previousOwner && ["node.exe", "cloudflared.exe"].includes(child.Name)) {
        try { process.kill(child.ProcessId); } catch (error) { if (error.code !== "ESRCH") throw error; }
      }
    }
  }
}
function log(name, message) {
  const file = path.join(logs, `${name}.log`);
  if (existsSync(file) && statSync(file).size > 10 * 1024 * 1024) renameSync(file, `${file}.previous`);
  // A dependency must not accidentally put connection credentials in a log.
  appendFileSync(file, String(message).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[database URL redacted]"));
}
function event(message) { log("supervisor", `${new Date().toISOString()} ${message}\n`); }
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
const pgCtl = path.join(root, "node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe");
const children = new Map();
let stopping = false;
let checking = false;
let failures = 0;
let lastDbCheck = 0;
async function stopChildren() {
  await Promise.all([...children.values()].map((child) => new Promise((resolve) => {
    child.once("close", resolve);
    if (!child.kill()) resolve();
  })));
}
function run(command, args, name) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => log(name, chunk));
    child.stderr.on("data", (chunk) => log(name, chunk));
    child.on("error", () => resolve(-1));
    child.on("exit", (code) => resolve(code));
  });
}
function ensure(name, command, args) {
  if (stopping || children.has(name)) return;
  const child = spawn(command, args, { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  children.set(name, child);
  event(`${name} started (PID ${child.pid}).`);
  child.stdout.on("data", (chunk) => log(name, chunk));
  child.stderr.on("data", (chunk) => log(name, chunk));
  child.on("error", () => event(`${name} failed to start.`));
  child.on("close", (code) => { children.delete(name); event(`${name} exited (${code}); restart will follow.`); });
}
async function tick() {
  if (checking || stopping) return;
  checking = true;
  try {
    if (existsSync(".postgres/server-stop")) { rmSync(".postgres/server-stop"); await stop(); return; }
    if (existsSync(".postgres/server-maintenance.json")) {
      const maintenance = JSON.parse(readFileSync(".postgres/server-maintenance.json", "utf8").replace(/^\uFEFF/, ""));
      let ownerAlive = true;
      try { process.kill(maintenance.pid, 0); } catch (error) { if (error.code === "ESRCH") ownerAlive = false; }
      if (ownerAlive) {
        await stopChildren();
        await db.$disconnect();
        lastDbCheck = 0;
        writeFileSync(path.join(logs, "status.json"), JSON.stringify({ checkedAt: new Date().toISOString(), pid: process.pid, maintenance: true, processes: {} }, null, 2));
        return;
      }
      rmSync(".postgres/server-maintenance.json");
      event("Abandoned backup maintenance cleared; resuming services.");
    }
    if (Date.now() - lastDbCheck > 10_000) {
      const status = await run(pgCtl, ["status", "-D", path.join(root, ".postgres/data")], "database-control");
      if (status !== 0) {
        event("PostgreSQL is stopped; starting the existing cluster.");
        const code = await run(pgCtl, ["start", "-D", path.join(root, ".postgres/data"), "-l", path.join(logs, "postgres.log"), "-o", "-h 127.0.0.1 -p 54329", "-w", "-t", "30"], "database-control");
        if (code !== 0) throw new Error("PostgreSQL start failed");
      }
      await db.$queryRaw`SELECT 1`;
      lastDbCheck = Date.now();
    }
    ensure("web", process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"]);
    ensure("worker", process.execPath, ["--import", "tsx", "scripts/notification-worker.ts"]);
    ensure("tunnel", config.cloudflared, ["tunnel", "--config", config.tunnelConfig, "--metrics", "127.0.0.1:0", "run", "buzz-transfers"]);
    let webHealthy = false;
    try { webHealthy = (await fetch("http://127.0.0.1:3100/login", { signal: AbortSignal.timeout(8000) })).ok; } catch { /* Retry during startup. */ }
    failures = webHealthy ? 0 : failures + 1;
    if (failures >= 6 && children.has("web")) { event("Web health checks failed; restarting web process."); children.get("web").kill(); failures = 0; }
    writeFileSync(path.join(logs, "status.json"), JSON.stringify({ checkedAt: new Date().toISOString(), pid: process.pid, database: true, webHealthy, processes: Object.fromEntries([...children].map(([name, child]) => [name, child.pid])) }, null, 2));
  } catch { event("Health check failed; retrying in five seconds. See component logs."); }
  finally { checking = false; }
}
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  await stopChildren();
  await db.$disconnect();
  // PostgreSQL stays persistent; use pg_ctl for an explicit maintenance stop.
  if (readFileSync(path.join(lock, "pid"), "utf8") === String(process.pid)) rmSync(lock, { recursive: true });
  event("Supervisor stopped.");
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
event("BUZZ production supervisor starting.");
const timer = setInterval(tick, 5000);
await tick();
