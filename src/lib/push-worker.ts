import { randomUUID } from "node:crypto";
import webpush from "web-push";
import { db } from "./db";
import { pushPayload, retryDelay } from "./notification-content";

import { getNotificationPolicy } from "./notification-settings";
import type { NotificationPolicy } from "./notification-policy";

type PushSender = typeof webpush.sendNotification;

// A durable per-device outbox, safe to run from several worker processes.
export async function runNotificationTick(
  send: PushSender = webpush.sendNotification,
) {
  const configured = !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
  await db.notificationWorker.upsert({
    where: { id: "push" },
    create: { id: "push", error: "STARTING" },
    update: { error: "STARTING" },
  });
  try {
    // Repair missing inbox entries, including any created by older app instances.
    await db.$executeRaw`
      INSERT INTO "TransferNotification" ("id", "transferId", "destinationId", "createdAt")
      SELECT 'incoming:' || t.id, t.id, t."destinationId", t."confirmedAt" FROM "Transfer" t
      WHERE t.approval IN ('PENDING', 'APPROVED') ON CONFLICT DO NOTHING`;
    await db.$executeRaw`
      UPDATE "TransferNotification" n SET "closedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      FROM "Transfer" t WHERE t.id = n."transferId" AND n."closedAt" IS NULL
        AND t.approval IN ('REJECTED', 'RECEIVED')`;
    await db.$executeRaw`
      INSERT INTO "PushDelivery" (id, "notificationId", "subscriptionId")
      SELECT 'push:' || md5(n.id || ':' || s.id), n.id, s.id
      FROM "TransferNotification" n
      JOIN "Transfer" t ON t.id = n."transferId"
      JOIN "User" u ON u.active = true AND (
        EXISTS (SELECT 1 FROM "_LocationToUser" lu WHERE lu."A" = n."destinationId" AND lu."B" = u.id)
        OR u.role = 'ADMIN'
      )
      JOIN "PushSubscription" s ON s."userId" = u.id
      WHERE n."acknowledgedAt" IS NULL AND n."closedAt" IS NULL
        AND t.approval IN ('PENDING', 'APPROVED')
      ON CONFLICT DO NOTHING`;
    if (configured) {
      const policy = await getNotificationPolicy();
      const maxSends =
        policy.maxReminders === null ? 2147483647 : policy.maxReminders + 1;
      const token = randomUUID();
      const jobs = await db.$queryRaw<{ id: string }[]>`
        WITH due AS (
          SELECT d.id FROM "PushDelivery" d
          JOIN "TransferNotification" n ON n.id = d."notificationId"
          WHERE (CASE WHEN d.failures = 0 AND d."lastSuccessAt" IS NOT NULL
            THEN d."lastSuccessAt" + (${policy.intervalMinutes} * INTERVAL '1 minute')
            ELSE d."nextAttemptAt" END) <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
            AND d.successes < ${maxSends}
            AND (d."lockedUntil" IS NULL OR d."lockedUntil" < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
            AND n."acknowledgedAt" IS NULL AND n."closedAt" IS NULL
          ORDER BY d."nextAttemptAt", d.id
          LIMIT 20 FOR UPDATE OF d SKIP LOCKED
        )
        UPDATE "PushDelivery" d SET "lockToken" = ${token},
          "lockedUntil" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '2 minutes'
        FROM due WHERE d.id = due.id RETURNING d.id`;
      await Promise.all(
        jobs.map((job) => deliver(job.id, token, send, policy)),
      );
    }
    await db.notificationWorker.update({
      where: { id: "push" },
      data: {
        checkedAt: new Date(),
        error: configured ? null : "PUSH_NOT_CONFIGURED",
      },
    });
  } catch (error) {
    await db.notificationWorker
      .update({ where: { id: "push" }, data: { error: "WORKER_FAILED" } })
      .catch(() => {});
    throw error;
  }
}

async function deliver(
  id: string,
  token: string,
  send: PushSender,
  policy: NotificationPolicy,
) {
  const job = await db.pushDelivery.findUnique({
    where: { id },
    include: {
      notification: {
        include: {
          transfer: {
            select: {
              number: true,
              source: true,
              destination: true,
              date: true,
              confirmedAt: true,
              creatorName: true,
              approval: true,
              total: true,
              remarks: true,
              lines: true,
            },
          },
        },
      },
      subscription: {
        include: {
          user: {
            select: {
              active: true,
              role: true,
              locale: true,
              locations: { select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!job || job.lockToken !== token) return;
  const { notification: n, subscription: sub } = job;
  const escalation =
    sub.user.role === "ADMIN" &&
    Date.now() - n.createdAt.getTime() >= 30 * 60_000;
  if (
    n.acknowledgedAt ||
    n.closedAt ||
    !["PENDING", "APPROVED"].includes(n.transfer.approval) ||
    !sub.user.active ||
    !(
      sub.user.role === "ADMIN" ||
      sub.user.locations.some((l) => l.id === n.destinationId)
    )
  ) {
    await db.pushDelivery.deleteMany({ where: { id, lockToken: token } });
    return;
  }
  const where = { id, lockToken: token };
  try {
    const payload = JSON.parse(
      pushPayload(n.id, n.transfer, sub.user.locale, job.successes > 0),
    );
    if (escalation)
      payload.title = `${sub.user.locale === "fa" ? "بی‌پاسخ" : "Overdue"} · ${payload.title}`;
    await send(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      {
        // A sleeping tablet or a phone without signal still gets the alert
        // when it wakes; five minutes dropped too many.
        TTL: 24 * 3600,
        urgency: "high",
        timeout: 10_000,
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT!,
          publicKey: process.env.VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!,
        },
      },
    );
    await db.pushDelivery.updateMany({
      where,
      data: {
        attempts: { increment: 1 },
        successes: { increment: 1 },
        failures: 0,
        lastSuccessAt: new Date(),
        lastError: null,
        nextAttemptAt: new Date(Date.now() + policy.intervalMinutes * 60_000),
        lockToken: null,
        lockedUntil: null,
      },
    });
  } catch (error) {
    const e = error as {
      statusCode?: number;
      headers?: Record<string, string>;
    };
    if (e.statusCode === 404 || e.statusCode === 410) {
      // A concurrent re-subscription may have refreshed the endpoint; preserve it.
      await db.pushSubscription.deleteMany({
        where: { id: sub.id, updatedAt: sub.updatedAt },
      });
      await db.pushDelivery.updateMany({
        where,
        data: {
          lockToken: null,
          lockedUntil: null,
          nextAttemptAt: new Date(Date.now() + 60_000),
        },
      });
      return;
    }
    const retryAfter = e.headers?.["retry-after"];
    const serverDelay = retryAfter
      ? /^\d+$/.test(retryAfter)
        ? Number(retryAfter) * 1000
        : Date.parse(retryAfter) - Date.now()
      : 0;
    const delay = Math.max(
      retryDelay(job.failures + 1),
      Math.min(Number.isFinite(serverDelay) ? serverDelay : 0, 24 * 3600_000),
    );
    await db.pushDelivery.updateMany({
      where,
      data: {
        attempts: { increment: 1 },
        failures: { increment: 1 },
        lastError: e.statusCode
          ? `PUSH_HTTP_${e.statusCode}`
          : "PUSH_NETWORK_ERROR",
        nextAttemptAt: new Date(Date.now() + delay),
        lockToken: null,
        lockedUntil: null,
      },
    });
  }
}
