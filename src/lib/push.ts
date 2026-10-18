import webpush from "web-push";
import { db } from "./db";

// Web Push needs a key pair (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). Without
// it notifications are simply off; nothing else in the app depends on them.
export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? "";
function configured() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
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
export async function notifyAdmins(message: {
  title: string;
  body: string;
  url: string;
}) {
  if (!configured()) return;
  const subscriptions = await db.pushSubscription.findMany({
    where: { user: { role: "ADMIN", active: true } },
  });
  await Promise.all(
    subscriptions.map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(message),
          { TTL: 24 * 3600 },
        )
        .catch(async (e: { statusCode?: number }) => {
          // The browser dropped this subscription; forget it.
          if (e.statusCode === 404 || e.statusCode === 410)
            await db.pushSubscription.deleteMany({ where: { id: s.id } });
        }),
    ),
  );
}
