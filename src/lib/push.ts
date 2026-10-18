import webpush from "web-push";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

// Web Push needs a key pair (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). Without
// it notifications are simply off; nothing else in the app depends on them.
export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? "";
function configured() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : (process.env.APP_ORIGIN ?? "http://127.0.0.1:3100");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? site,
    publicKey,
    privateKey,
  );
  return true;
}
type Message = { title: string; body: string; url: string };
// Sends to every matching device and reports what the push services said,
// so a test from Settings can show why nothing arrived.
export async function sendPush(
  where: Prisma.PushSubscriptionWhereInput,
  message: Message,
) {
  if (!configured()) return { sent: 0, errors: ["not configured"] };
  const subscriptions = await db.pushSubscription.findMany({ where });
  const errors: string[] = [];
  let sent = 0;
  await Promise.all(
    subscriptions.map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(message),
          { TTL: 24 * 3600, urgency: "high" },
        )
        .then(() => sent++)
        .catch(
          async (e: {
            statusCode?: number;
            body?: string;
            message?: string;
          }) => {
            errors.push(
              `${e.statusCode ?? ""} ${e.body || e.message || ""}`.trim(),
            );
            // The browser dropped this subscription; forget it.
            if (e.statusCode === 404 || e.statusCode === 410)
              await db.pushSubscription.deleteMany({ where: { id: s.id } });
          },
        ),
    ),
  );
  return { sent, errors };
}
export async function notifyAdmins(message: Message) {
  await sendPush({ user: { role: "ADMIN", active: true } }, message);
}
