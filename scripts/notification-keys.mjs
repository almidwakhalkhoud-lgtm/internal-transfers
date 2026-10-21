import webpush from "web-push";
import { readFileSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const env = readFileSync(".env", "utf8");
if (/^VAPID_(PUBLIC|PRIVATE)_KEY=\S+/m.test(env)) {
  console.log(
    "Existing keys preserved. Rotating keys would invalidate registered devices.",
  );
} else {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  appendFileSync(
    ".env",
    `\nVAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\n`,
    { mode: 0o600 },
  );
  console.log(
    "VAPID keys saved in .env. Set VAPID_SUBJECT to your operator's mailto: address, then restart the app and worker.",
  );
}
if (!/^CRON_SECRET=\S+/m.test(env)) {
  appendFileSync(".env", `\nCRON_SECRET=${randomBytes(32).toString("hex")}\n`, {
    mode: 0o600,
  });
  console.log(
    "Scheduler secret saved in .env. Copy it securely to the production scheduler and Vercel environment.",
  );
}
