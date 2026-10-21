import { Prisma, type TransferNotification } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./auth";
import { ESCALATION_MS, notificationContent } from "./notification-content";

import { getNotificationPolicy } from "./notification-settings";

type Recipient = {
  id: string;
  name: string;
  role: string;
  locale: string;
  locations: { id: string }[];
};
export function notificationAccess(
  user: Recipient,
): Prisma.TransferNotificationWhereInput {
  return user.role === "ADMIN"
    ? {}
    : { destinationId: { in: user.locations.map((l) => l.id) } };
}
export const outstanding: Prisma.TransferNotificationWhereInput = {
  acknowledgedAt: null,
  closedAt: null,
};
export const notificationTransferSelect = {
  id: true,
  number: true,
  source: true,
  destination: true,
  date: true,
  confirmedAt: true,
  creatorName: true,
  approval: true,
  lines: true,
  total: true,
  remarks: true,
} satisfies Prisma.TransferSelect;

export async function notificationInbox(
  user: Recipient,
  page: number,
  history: boolean,
  id?: string,
  compact = false,
) {
  const policy = await getNotificationPolicy();
  const scope = notificationAccess(user);
  const active = { AND: [scope, outstanding] };
  const where = {
    AND: [scope, ...(id ? [{ id }] : history ? [] : [outstanding])],
  };
  const [items, count, pending, overdue, worker, retryingDevices] =
    await Promise.all([
      db.transferNotification.findMany({
        where,
        include: {
          transfer: {
            select: {
              ...notificationTransferSelect,
              lines: !compact,
              remarks: !compact,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: compact ? 1 : 20,
        skip: id ? 0 : page * 20,
      }),
      db.transferNotification.count({ where }),
      db.transferNotification.count({ where: active }),
      db.transferNotification.count({
        where: {
          AND: [
            active,
            { createdAt: { lte: new Date(Date.now() - ESCALATION_MS) } },
          ],
        },
      }),
      db.notificationWorker.findUnique({ where: { id: "push" } }),
      db.pushDelivery.count({
        where: {
          failures: { gt: 0 },
          ...(policy.maxReminders === null
            ? {}
            : { successes: { lt: policy.maxReminders + 1 } }),
          notification: active,
          ...(user.role === "ADMIN"
            ? {}
            : { subscription: { userId: user.id } }),
        },
      }),
    ]);
  return {
    items: items.map((n) => ({
      ...n,
      transfer: { ...n.transfer, total: n.transfer.total.toString() },
      ...(compact
        ? {
            title:
              user.locale === "fa"
                ? `ترانسفر ورودی ${n.transfer.number} برای ${n.transfer.destination}`
                : `Incoming transfer ${n.transfer.number} for ${n.transfer.destination}`,
            body: "",
          }
        : notificationContent(n.transfer, user.locale, policy)),
    })),
    policy,
    count,
    pending,
    overdue,
    retryingDevices,
    pushConfigured: !!(
      process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
    ),
    workerHealthy:
      !!worker &&
      !worker.error &&
      Date.now() - worker.checkedAt.getTime() < 90_000,
    ...(user.role === "ADMIN"
      ? { coverage: await notificationCoverage() }
      : {}),
  };
}

async function notificationCoverage() {
  const groups = await db.transferNotification.groupBy({
    by: ["destinationId"],
    where: outstanding,
    _count: true,
  });
  if (!groups.length) return [];
  const locations = await db.location.findMany({
    where: { id: { in: groups.map((g) => g.destinationId) } },
    include: {
      users: {
        where: { active: true },
        select: { id: true, _count: { select: { pushSubscriptions: true } } },
      },
    },
  });
  return groups.map((g) => {
    const location = locations.find((l) => l.id === g.destinationId);
    return {
      destinationId: g.destinationId,
      name: location?.name ?? g.destinationId,
      pending: g._count,
      recipients: location?.users.length ?? 0,
      devices:
        location?.users.reduce((n, u) => n + u._count.pushSubscriptions, 0) ??
        0,
    };
  });
}

export async function acknowledgeNotification(user: Recipient, id: string) {
  return db.$transaction(async (tx) => {
    const item = await tx.transferNotification.findFirst({
      where: { AND: [{ id }, notificationAccess(user)] },
    });
    if (!item) throw new HttpError(404, "Notification not found");
    if (item.acknowledgedAt || item.closedAt) return { ok: true };
    const result = await tx.transferNotification.updateMany({
      where: { id, ...outstanding },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: user.id,
        acknowledgedName: user.name,
      },
    });
    if (result.count)
      await tx.audit.create({
        data: {
          actor: user.id,
          action: "TRANSFER_NOTIFICATION_ACKNOWLEDGED",
          target: item.transferId,
          detail: {
            notificationId: id,
            destinationId: item.destinationId,
            acknowledgedName: user.name,
          },
        },
      });
    return { ok: true };
  });
}

export function validPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      (url.hostname === "fcm.googleapis.com" ||
        url.hostname === "updates.push.services.mozilla.com" ||
        url.hostname === "web.push.apple.com" ||
        /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname))
    );
  } catch {
    return false;
  }
}

export async function savePushSubscription(
  user: Recipient,
  data: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  if (!validPushEndpoint(data.endpoint))
    throw new HttpError(400, "Unsupported push service");
  // Lock the owner to serialize device limit checks and subscription changes.
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
    const existing = await tx.pushSubscription.findUnique({
      where: { endpoint: data.endpoint },
    });
    if (
      !existing &&
      (await tx.pushSubscription.count({ where: { userId: user.id } })) >= 10
    )
      throw new HttpError(
        409,
        "Device limit reached. Remove an old notification device first.",
      );
    // An account change on a shared device must not inherit another account's jobs.
    if (existing && existing.userId !== user.id) {
      if (
        (await tx.pushSubscription.count({ where: { userId: user.id } })) >= 10
      )
        throw new HttpError(
          409,
          "Device limit reached. Remove an old notification device first.",
        );
      await tx.pushDelivery.deleteMany({
        where: { subscriptionId: existing.id },
      });
    }
    await tx.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: { userId: user.id, endpoint: data.endpoint, ...data.keys },
      update: { userId: user.id, ...data.keys },
    });
  });
}

export function notificationIsOpen(
  n: Pick<TransferNotification, "acknowledgedAt" | "closedAt">,
) {
  return !n.acknowledgedAt && !n.closedAt;
}
