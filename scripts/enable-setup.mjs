import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync(".postgres", { recursive: true });
const token = randomBytes(32).toString("hex");
writeFileSync(".postgres/setup-token", token, { mode: 0o600 });
writeFileSync(
  ".postgres/admin-setup-link.txt",
  `http://127.0.0.1:3100/setup?token=${token}`,
  { mode: 0o600 },
);
console.log(
  "One-time setup link written to .postgres/admin-setup-link.txt. It is not logged or tracked in Git.",
);
