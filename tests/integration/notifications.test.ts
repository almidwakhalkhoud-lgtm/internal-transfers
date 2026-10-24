import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { confirmTransfer } from "../../src/lib/transfers";
import {
  acknowledgeNotification,
  notificationInbox,
  savePushSubscription,
  validPushEndpoint,
} from "../../src/lib/notifications";
import { runNotificationTick } from "../../src/lib/push-worker";
import type webpush from "web-push";
import {
  getNotificationPolicy,
  saveNotificationPolicy,
} from "../../src/lib/notification-settings";
const sender = vi.fn<typeof webpush.sendNotification>();
let creator: Awaited<ReturnType<typeof db.user.findUniqueOrThrow>> & {
  locations: { id: string; name: string; active: boolean }[];
  viewLocations: { id: string; name: string; active: boolean }[];
};
let recipient: typeof creator;
let outsider: typeof creator;
let admin: typeof creator;
const subscription = (suffix: string) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${suffix}`,
  keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
});
async function input(remarks = "Integration transfer") {
  const key = randomUUID();
  await db.draft.create({ data: { id: key, userId: creator.id, data: {} } });
  const product = await db.product.findUniqueOrThrow({
    where: { id: "notify-product" },
  });
  return {
    key,
    sourceId: "notify-source",
    destinationId: "notify-shop",
    date: "2026-10-21",
    remarks,
    lines: [
      {
        productId: product.id,
        version: product.updatedAt.toISOString(),
        quantity: "2.5",
        unit: "کارتن",
      },
    ],
  };
}
async function makeTransfer() {
  const t = await confirmTransfer(creator, await input());
  return db.transferNotification.findUniqueOrThrow({
    where: { transferId: t.id },
  });
}
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.port !== "54339" || url.pathname !== "/buzz_notifications_test")
    throw new Error("Wrong integration database");
  [creator, recipient, outsider, admin] = await Promise.all(
    [
      "notify-creator",
      "notify-recipient",
      "notify-other-user",
      "notify-admin",
    ].map((id) =>
      db.user.findUniqueOrThrow({
        where: { id },
        include: { locations: true, viewLocations: true },
      }),
    ),
  );
  sender.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
});
afterAll(() => db.$disconnect());
beforeEach(async () => {
  // Keep device registrations, but isolate each test's actionable transfers.
  await db.transferNotification.updateMany({
    where: { closedAt: null },
    data: { closedAt: new Date() },
  });
  await db.notificationSettings.deleteMany();
  sender.mockReset();
  sender.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
});
describe.sequential("durable destination notifications", () => {
  it("creates exactly one inbox entry on duplicate confirmation, independently of PDF", async () => {
    const data = await input();
    const [a, b] = await Promise.all([
      confirmTransfer(creator, data),
      confirmTransfer(creator, data),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      await db.transferNotification.count({ where: { transferId: a.id } }),
    ).toBe(1);
    expect(a.pdf).toBeNull();
  });
  it("rolls back transfer creation when persisting its notification fails", async () => {
    await db.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION test_notification_failure() RETURNS trigger AS $$ BEGIN IF EXISTS (SELECT 1 FROM "Transfer" WHERE id = NEW."transferId" AND remarks = 'INJECT_NOTIFICATION_FAILURE') THEN RAISE EXCEPTION 'Test failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER test_notification_failure BEFORE INSERT ON "TransferNotification" FOR EACH ROW EXECUTE FUNCTION test_notification_failure()',
    );
    const data = await input("INJECT_NOTIFICATION_FAILURE");
    try {
      await expect(confirmTransfer(creator, data)).rejects.toThrow();
      expect(await db.transfer.count({ where: { key: data.key } })).toBe(0);
      expect(await db.draft.count({ where: { id: data.key } })).toBe(1);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER test_notification_failure ON "TransferNotification"',
      );
    }
  });
  it("excludes source-only and unrelated users; opening never acknowledges", async () => {
    const n = await makeTransfer();
    expect(
      (await notificationInbox(recipient, 0, false, n.id)).items,
    ).toHaveLength(1);
    expect(
      (await notificationInbox(outsider, 0, true, n.id)).items,
    ).toHaveLength(0);
    expect(
      (await db.transferNotification.findUniqueOrThrow({ where: { id: n.id } }))
        .acknowledgedAt,
    ).toBeNull();
    await expect(acknowledgeNotification(outsider, n.id)).rejects.toMatchObject(
      { status: 404 },
    );
    await db.user.update({
      where: { id: outsider.id },
      data: { locations: { set: [{ id: "notify-source" }] } },
    });
    expect(
      (
        await notificationInbox(
          { ...outsider, locations: [{ id: "notify-source" }] },
          0,
          true,
          n.id,
        )
      ).items,
    ).toHaveLength(0);
    await db.user.update({
      where: { id: outsider.id },
      data: { locations: { set: [{ id: "notify-other" }] } },
    });
  });
  it("atomically shares acknowledgment across the shop and audits it once", async () => {
    const n = await makeTransfer();
    await Promise.all([
      acknowledgeNotification(recipient, n.id),
      acknowledgeNotification(creator, n.id),
    ]);
    expect(
      (await notificationInbox(recipient, 0, false)).items.some(
        (i) => i.id === n.id,
      ),
    ).toBe(false);
    expect(
      (await notificationInbox(recipient, 0, true, n.id)).items[0]
        .acknowledgedAt,
    ).toBeTruthy();
    expect(
      await db.audit.count({
        where: {
          action: "TRANSFER_NOTIFICATION_ACKNOWLEDGED",
          target: n.transferId,
        },
      }),
    ).toBe(1);
    expect(
      (await db.transfer.findUniqueOrThrow({ where: { id: n.transferId } }))
        .approval,
    ).toBe("PENDING");
  });
  it("keeps notifications durable when no device is registered", async () => {
    const n = await makeTransfer();
    await runNotificationTick(sender);
    expect(
      await db.transferNotification.findUnique({ where: { id: n.id } }),
    ).toBeTruthy();
    expect(
      await db.pushDelivery.count({ where: { notificationId: n.id } }),
    ).toBe(0);
  });
  it("fans out to new devices without duplicate jobs and repeats after five minutes", async () => {
    const n = await makeTransfer();
    await savePushSubscription(recipient, subscription("device-a"));
    await savePushSubscription(recipient, subscription("device-b"));
    await runNotificationTick(sender);
    expect(
      await db.pushDelivery.count({ where: { notificationId: n.id } }),
    ).toBe(2);
    const before = sender.mock.calls.length;
    await runNotificationTick(sender);
    expect(sender.mock.calls.length).toBe(before);
    await db.pushDelivery.updateMany({
      where: { notificationId: n.id },
      data: { nextAttemptAt: new Date(0), lastSuccessAt: new Date(0) },
    });
    await runNotificationTick(sender);
    expect(sender.mock.calls.length).toBe(before + 2);
    const job = await db.pushDelivery.findFirstOrThrow({
      where: { notificationId: n.id },
    });
    expect(job.lastSuccessAt).toBeTruthy();
    expect(job.attempts).toBe(2);
    expect(
      (await db.transferNotification.findUniqueOrThrow({ where: { id: n.id } }))
        .acknowledgedAt,
    ).toBeNull();
  });
  it("keeps two workers from claiming the same delivery", async () => {
    const n = await makeTransfer();
    sender.mockClear();
    await Promise.all([
      runNotificationTick(sender),
      runNotificationTick(sender),
    ]);
    const calls = sender.mock.calls.filter(
      ([, payload]) => JSON.parse(String(payload)).id === n.id,
    );
    expect(calls).toHaveLength(2);
    expect(
      await db.pushDelivery.count({ where: { notificationId: n.id } }),
    ).toBe(2);
  });
  it("retries a failed device independently and honors provider backoff", async () => {
    const n = await makeTransfer();
    sender.mockImplementation(async (sub) => {
      if (sub.endpoint.endsWith("device-a"))
        throw { statusCode: 429, headers: { "retry-after": "600" } };
      return { statusCode: 201, body: "", headers: {} };
    });
    await runNotificationTick(sender);
    const jobs = await db.pushDelivery.findMany({
      where: { notificationId: n.id },
      orderBy: { failures: "desc" },
    });
    expect(jobs[0].lastError).toBe("PUSH_HTTP_429");
    expect(jobs[0].nextAttemptAt.getTime() - Date.now()).toBeGreaterThan(
      590_000,
    );
    expect(jobs[1].lastSuccessAt).toBeTruthy();
    sender.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
  });
  it("recovers an expired lease after worker interruption", async () => {
    const n = await makeTransfer();
    await runNotificationTick(sender);
    const job = await db.pushDelivery.findFirstOrThrow({
      where: { notificationId: n.id },
    });
    await db.pushDelivery.update({
      where: { id: job.id },
      data: {
        lastSuccessAt: new Date(0),
        lockToken: "dead-worker",
        lockedUntil: new Date(Date.now() + 60_000),
        nextAttemptAt: new Date(0),
      },
    });
    await runNotificationTick(sender);
    expect(
      (await db.pushDelivery.findUniqueOrThrow({ where: { id: job.id } }))
        .attempts,
    ).toBe(1);
    await db.pushDelivery.update({
      where: { id: job.id },
      data: { lockedUntil: new Date(0) },
    });
    await runNotificationTick(sender);
    expect(
      (await db.pushDelivery.findUniqueOrThrow({ where: { id: job.id } }))
        .attempts,
    ).toBe(2);
  });
  it("stops future delivery after shop acknowledgment", async () => {
    const n = await makeTransfer();
    await runNotificationTick(sender);
    await acknowledgeNotification(recipient, n.id);
    await db.pushDelivery.updateMany({
      where: { notificationId: n.id },
      data: { nextAttemptAt: new Date(0), lastSuccessAt: new Date(0) },
    });
    sender.mockClear();
    await runNotificationTick(sender);
    expect(
      sender.mock.calls.filter(
        ([, payload]) => JSON.parse(String(payload)).id === n.id,
      ),
    ).toHaveLength(0);
  });
  it("suppresses delivery after destination access is revoked", async () => {
    const n = await makeTransfer();
    await runNotificationTick(sender);
    await db.user.update({
      where: { id: recipient.id },
      data: { locations: { set: [] } },
    });
    await db.pushDelivery.updateMany({
      where: { notificationId: n.id },
      data: { nextAttemptAt: new Date(0), lastSuccessAt: new Date(0) },
    });
    sender.mockClear();
    await runNotificationTick(sender);
    expect(
      sender.mock.calls.filter(
        ([, payload]) => JSON.parse(String(payload)).id === n.id,
      ),
    ).toHaveLength(0);
    await db.user.update({
      where: { id: recipient.id },
      data: { locations: { set: [{ id: "notify-shop" }] } },
    });
  });
  it("escalates overdue unacknowledged transfers to administrator devices", async () => {
    const n = await makeTransfer();
    await db.transferNotification.update({
      where: { id: n.id },
      data: { createdAt: new Date(Date.now() - 31 * 60_000) },
    });
    await savePushSubscription(admin, subscription("admin-device"));
    sender.mockClear();
    await runNotificationTick(sender);
    expect(
      sender.mock.calls.some(
        ([sub, payload]) =>
          sub.endpoint.endsWith("admin-device") &&
          JSON.parse(String(payload)).id === n.id &&
          JSON.parse(String(payload)).title.includes("Overdue"),
      ),
    ).toBe(true);
    const inbox = await notificationInbox(admin, 0, false);
    expect(inbox.overdue).toBeGreaterThan(0);
    expect(inbox.workerHealthy).toBe(true);
  });
  it("removes expired subscriptions without losing inbox entries", async () => {
    const n = await makeTransfer();
    await savePushSubscription(recipient, subscription("expired-device"));
    sender.mockImplementation(async (sub) => {
      if (sub.endpoint.endsWith("expired-device")) throw { statusCode: 410 };
      return { statusCode: 201, body: "", headers: {} };
    });
    await runNotificationTick(sender);
    expect(
      await db.pushSubscription.findUnique({
        where: { endpoint: subscription("expired-device").endpoint },
      }),
    ).toBeNull();
    expect(
      (await db.transferNotification.findUniqueOrThrow({ where: { id: n.id } }))
        .acknowledgedAt,
    ).toBeNull();
    sender.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
  });
  it("closes reminders for rejected transfers without inventing acknowledgment", async () => {
    const n = await makeTransfer();
    await db.transfer.update({
      where: { id: n.transferId },
      data: { approval: "REJECTED" },
    });
    sender.mockClear();
    await runNotificationTick(sender);
    const saved = await db.transferNotification.findUniqueOrThrow({
      where: { id: n.id },
    });
    expect(saved.closedAt).toBeTruthy();
    expect(saved.acknowledgedAt).toBeNull();
    expect(
      sender.mock.calls.filter(
        ([, payload]) => JSON.parse(String(payload)).id === n.id,
      ),
    ).toHaveLength(0);
  });
  it("protects push dispatch against private endpoints and cross-account delivery reuse", async () => {
    await makeTransfer();
    for (const endpoint of [
      "http://127.0.0.1/",
      "https://127.0.0.1/",
      "https://fcm.googleapis.com.evil.test/a",
      "https://evil.test/",
      "https://fcm.googleapis.com:444/a",
      "https://user:password@fcm.googleapis.com/a",
    ])
      expect(validPushEndpoint(endpoint)).toBe(false);
    const data = subscription("rebound-device");
    await savePushSubscription(recipient, data);
    await runNotificationTick(sender);
    const sub = await db.pushSubscription.findUniqueOrThrow({
      where: { endpoint: data.endpoint },
    });
    expect(
      await db.pushDelivery.count({ where: { subscriptionId: sub.id } }),
    ).toBeGreaterThan(0);
    await savePushSubscription(outsider, data);
    expect(
      await db.pushDelivery.count({ where: { subscriptionId: sub.id } }),
    ).toBe(0);
    expect(
      (await db.pushSubscription.findUniqueOrThrow({ where: { id: sub.id } }))
        .userId,
    ).toBe(outsider.id);
  });
  it("keeps immediate administrator alerts in the durable queue", async () => {
    const n = await makeTransfer();
    await runNotificationTick(sender);
    const calls = sender.mock.calls.filter(
      ([sub, payload]) =>
        sub.endpoint.endsWith("admin-device") &&
        JSON.parse(String(payload)).id === n.id,
    );
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0][1])).title).not.toContain("Overdue");
  });
  it("also persists destination alerts for transfers fulfilled from stock requests", async () => {
    const { insertTransfer } = await import("../../src/lib/transfers");
    const transfer = await db.$transaction(async (tx) => {
      const seq = await tx.sequence.upsert({
        where: { id: "transfer" },
        create: { id: "transfer", value: 1 },
        update: { value: { increment: 1 } },
      });
      return insertTransfer(tx, creator, {
        key: randomUUID(),
        sequence: seq.value,
        source: { id: "notify-source", name: "Central warehouse" },
        destination: { id: "notify-shop", name: "مغازه مقصد" },
        date: new Date("2026-10-21"),
        remarks: "From stock request",
        lines: [
          {
            code: "000123",
            description: "Requested product",
            quantity: "1",
            unit: "کارتن",
            barcodes: [],
            note: "Full request line note",
          },
        ],
        detail: { request: "REQ00001" },
      });
    });
    const notification = await db.transferNotification.findUniqueOrThrow({
      where: { transferId: transfer.id },
    });
    expect(
      (await notificationInbox(recipient, 0, false, notification.id)).items[0]
        .body,
    ).toContain("Full request line note");
  });
  it("persists administrator policy atomically, validates limits and denies staff changes", async () => {
    expect(await getNotificationPolicy()).toEqual({
      intervalMinutes: 360,
      maxReminders: 2,
      requireDevice: true,
    });
    await expect(
      saveNotificationPolicy(recipient, {
        intervalMinutes: 2,
        maxReminders: 3,
      }),
    ).rejects.toMatchObject({ status: 403 });
    for (const policy of [
      { intervalMinutes: 0, maxReminders: null },
      { intervalMinutes: 1441, maxReminders: null },
      { intervalMinutes: 2.5, maxReminders: 3 },
      { intervalMinutes: 2, maxReminders: -1 },
      { intervalMinutes: 2, maxReminders: 101 },
      { intervalMinutes: 2, maxReminders: "3" },
    ])
      await expect(saveNotificationPolicy(admin, policy)).rejects.toThrow();
    expect(await getNotificationPolicy()).toEqual({
      intervalMinutes: 360,
      maxReminders: 2,
      requireDevice: true,
    });
    await saveNotificationPolicy(admin, {
      intervalMinutes: 12,
      maxReminders: 3,
    });
    expect(await getNotificationPolicy()).toEqual({
      intervalMinutes: 12,
      maxReminders: 3,
      requireDevice: true,
    });
    const audit = await db.audit.findFirstOrThrow({
      where: { action: "NOTIFICATION_SETTINGS_UPDATED", actor: admin.id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit.detail).toEqual({
      intervalMinutes: 12,
      maxReminders: 3,
      requireDevice: true,
    });
  });
  it("uses the configured interval and applies increases and decreases to existing deliveries", async () => {
    const n = await makeTransfer();
    const data = subscription("custom-interval");
    await savePushSubscription(recipient, data);
    await saveNotificationPolicy(admin, {
      intervalMinutes: 12,
      maxReminders: null,
    });
    await runNotificationTick(sender);
    const job = await db.pushDelivery.findFirstOrThrow({
      where: {
        notificationId: n.id,
        subscription: { endpoint: data.endpoint },
      },
    });
    expect(
      job.nextAttemptAt.getTime() - job.lastSuccessAt!.getTime(),
    ).toBeGreaterThanOrEqual(12 * 60_000 - 1000);
    await db.pushDelivery.update({
      where: { id: job.id },
      data: {
        lastSuccessAt: new Date(Date.now() - 6 * 60_000),
        nextAttemptAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    await saveNotificationPolicy(admin, {
      intervalMinutes: 20,
      maxReminders: null,
    });
    sender.mockClear();
    await runNotificationTick(sender);
    expect(
      sender.mock.calls.filter(([sub]) => sub.endpoint === data.endpoint),
    ).toHaveLength(0);
    await saveNotificationPolicy(admin, {
      intervalMinutes: 2,
      maxReminders: null,
    });
    await runNotificationTick(sender);
    const calls = sender.mock.calls.filter(
      ([sub]) => sub.endpoint === data.endpoint,
    );
    expect(calls).toHaveLength(1);
    // The phone shows a short alert; the reminder schedule is in the inbox.
    expect(JSON.parse(String(calls[0][1])).title).toContain("یادآوری");
    expect(
      (await notificationInbox(recipient, 0, false)).items[0].body,
    ).toContain("هر 2 دقیقه");
  });
  it("caps successful reminders per device, preserves the inbox and resumes when the cap is raised", async () => {
    const n = await makeTransfer();
    const data = subscription("bounded-reminders");
    await savePushSubscription(recipient, data);
    await saveNotificationPolicy(admin, {
      intervalMinutes: 1,
      maxReminders: 1,
    });
    await runNotificationTick(sender);
    const job = await db.pushDelivery.findFirstOrThrow({
      where: {
        notificationId: n.id,
        subscription: { endpoint: data.endpoint },
      },
    });
    for (let i = 0; i < 3; i++) {
      await db.pushDelivery.update({
        where: { id: job.id },
        data: { lastSuccessAt: new Date(0), nextAttemptAt: new Date(0) },
      });
      await runNotificationTick(sender);
    }
    expect(
      (await db.pushDelivery.findUniqueOrThrow({ where: { id: job.id } }))
        .successes,
    ).toBe(2);
    expect(
      sender.mock.calls.filter(([sub]) => sub.endpoint === data.endpoint),
    ).toHaveLength(2);
    expect(
      (await notificationInbox(recipient, 0, false, n.id)).items,
    ).toHaveLength(1);
    expect(
      (await db.transferNotification.findUniqueOrThrow({ where: { id: n.id } }))
        .acknowledgedAt,
    ).toBeNull();
    const newDevice = subscription("bounded-new-device");
    await savePushSubscription(recipient, newDevice);
    await runNotificationTick(sender);
    expect(
      sender.mock.calls.filter(([sub]) => sub.endpoint === newDevice.endpoint),
    ).toHaveLength(1);
    await saveNotificationPolicy(admin, {
      intervalMinutes: 1,
      maxReminders: 3,
    });
    await runNotificationTick(sender);
    expect(
      (await db.pushDelivery.findUniqueOrThrow({ where: { id: job.id } }))
        .successes,
    ).toBe(3);
  });
  it("initial-only mode still retries failed sends without consuming the successful delivery limit", async () => {
    const n = await makeTransfer();
    const data = subscription("initial-only-retry");
    await savePushSubscription(recipient, data);
    await saveNotificationPolicy(admin, {
      intervalMinutes: 5,
      maxReminders: 0,
    });
    sender.mockImplementation(async (sub) => {
      if (sub.endpoint === data.endpoint) throw { statusCode: 503 };
      return { statusCode: 201, body: "", headers: {} };
    });
    await runNotificationTick(sender);
    const job = await db.pushDelivery.findFirstOrThrow({
      where: {
        notificationId: n.id,
        subscription: { endpoint: data.endpoint },
      },
    });
    expect(job.successes).toBe(0);
    expect(job.attempts).toBe(1);
    await db.pushDelivery.update({
      where: { id: job.id },
      data: { nextAttemptAt: new Date(0) },
    });
    sender.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
    await runNotificationTick(sender);
    const saved = await db.pushDelivery.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(saved.successes).toBe(1);
    expect(saved.attempts).toBe(2);
    await db.pushDelivery.update({
      where: { id: job.id },
      data: { nextAttemptAt: new Date(0), lastSuccessAt: new Date(0) },
    });
    sender.mockClear();
    await runNotificationTick(sender);
    expect(
      sender.mock.calls.filter(([sub]) => sub.endpoint === data.endpoint),
    ).toHaveLength(0);
    expect(
      (await notificationInbox(recipient, 0, false, n.id)).items[0].body,
    ).toContain("فقط اعلان اول");
  });
});
