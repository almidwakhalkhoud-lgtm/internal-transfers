import { test, expect, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
const db = new PrismaClient();
const origin = "http://127.0.0.1:3102";
const auth = async (context: BrowserContext, kind = "RECIPIENT") =>
  context.addCookies([
    {
      name: "buzz-session",
      value: process.env[`BUZZ_TEST_${kind}_SESSION`]!,
      url: origin,
    },
  ]);
async function incoming(
  options: {
    id?: string;
    destinationId?: string;
    destination?: string;
    count?: number;
    remarks?: string;
  } = {},
) {
  const unique = randomUUID();
  const t = await db.transfer.create({
    data: {
      number: `UI-${unique.slice(0, 8)}`,
      key: unique,
      creatorId: "notify-creator",
      creatorName: "Sending employee",
      sourceId: "notify-source",
      source: "Central warehouse",
      destinationId: options.destinationId ?? "notify-shop",
      destination: options.destination ?? "مغازه مقصد",
      date: new Date("2026-10-21"),
      confirmedAt: new Date(),
      remarks:
        options.remarks ?? "شرح کامل برای تحویل\nاین خط دوم توضیحات است.",
      lines: Array.from({ length: options.count ?? 2 }, (_, i) => ({
        code: `000${i}`,
        description: `شرح کامل کالای ${i + 1}`,
        quantity: "2.5",
        unit: "کارتن",
        barcodes: [`00123${i}`],
      })),
      total: "5.000",
    },
  });
  const saved = await db.transferNotification.findUniqueOrThrow({
    where: { transferId: t.id },
  });
  const n = options.id
    ? await db.transferNotification.update({
        where: { id: saved.id },
        data: { id: options.id },
      })
    : saved;
  return { t, n };
}
test.beforeAll(() => {
  const url = new URL(process.env.DATABASE_URL!);
  expect(url.port).toBe("54339");
  expect(url.pathname).toBe("/buzz_notifications_test");
});
test.beforeEach(async ({ context }) => {
  await db.transferNotification.updateMany({
    where: { closedAt: null },
    data: { closedAt: new Date() },
  });
  await auth(context);
});
test.afterAll(() => db.$disconnect());

test("full Persian notification, menu-independent access and explicit shop acknowledgment", async ({
  page,
}) => {
  const { t, n } = await incoming({
    count: 35,
    remarks: "توضیحات کامل " + "یادداشت مفصل؛ ".repeat(100),
  });
  await page.goto(`/notifications?notification=${n.id}`);
  const text = page.locator(".notification-full-text");
  await expect(text).toContainText(t.number);
  await expect(text).toContainText("Central warehouse");
  await expect(text).toContainText("مغازه مقصد");
  await expect(text).toContainText("Sending employee");
  await expect(text).toContainText("شرح کامل کالای 35");
  await expect(text).toContainText(t.remarks);
  expect(
    (await db.transferNotification.findUniqueOrThrow({ where: { id: n.id } }))
      .acknowledgedAt,
  ).toBeNull();
  await expect(
    page.getByRole("link", { name: "Transfer details", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "از ترانسفر مطلع شدم", exact: true })
    .click();
  await expect(
    page.getByText(
      "اطلاع مغازه ثبت شد. یادآوری این ترانسفر برای مغازه شما متوقف شد.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/ثبت اطلاع توسط مدیر مغازه/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/ثبت اطلاع توسط مدیر مغازه/)).toBeVisible();
  expect(
    (await db.transfer.findUniqueOrThrow({ where: { id: t.id } })).approval,
  ).toBe("PENDING");
});

test("live polling notices a transfer while the shop is on another page", async ({
  page,
}) => {
  await page.goto("/access");
  await expect(page.locator(".incoming-banner")).toHaveCount(0);
  const { t } = await incoming();
  await expect(page.locator(".incoming-banner")).toContainText(t.number);
  await expect(page.locator(".notification-count")).toHaveText("1");
  await expect(page).toHaveTitle(/\(1\)/);
  await page.getByRole("link", { name: "بررسی اعلان‌ها" }).click();
  await expect(page.locator(".notification-full-text")).toContainText(t.number);
});

test("reconnect recovers a transfer created offline without acknowledging it", async ({
  page,
  context,
}) => {
  const id = `offline-${randomUUID()}`;
  await page.goto(`/notifications?notification=${id}`);
  await expect(
    page.getByText("اعلان پیدا نشد یا دسترسی شما تغییر کرده است."),
  ).toBeVisible();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".notification-connection")).toBeVisible();
  const { t, n } = await incoming({ id });
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator(".notification-full-text")).toContainText(t.number);
  await expect(page.locator(".notification-connection")).toHaveCount(0);
  expect(
    (await db.transferNotification.findUniqueOrThrow({ where: { id: n.id } }))
      .acknowledgedAt,
  ).toBeNull();
});

test("server blocks other shops, unauthenticated access and cross-origin acknowledgment", async ({
  page,
  browser,
}) => {
  const { n } = await incoming();
  const other = await browser.newContext();
  await auth(other, "OTHER");
  const list = await other.request.get(
    `${origin}/api/notifications?id=${n.id}`,
  );
  expect((await list.json()).items).toHaveLength(0);
  expect(
    (
      await other.request.post(
        `${origin}/api/notifications/${n.id}/acknowledge`,
        { headers: { Origin: origin }, data: {} },
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post(`/api/notifications/${n.id}/acknowledge`, {
        headers: { Origin: "https://untrusted.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const anonymous = await browser.newContext();
  expect(
    (await anonymous.request.get(`${origin}/api/notifications`)).status(),
  ).toBe(401);
  await anonymous.close();
  await other.close();
});

test("administrator rejection closes reminders without recording a shop acknowledgment", async ({
  page,
  browser,
}) => {
  const { n, t } = await incoming();
  const admin = await browser.newContext();
  await auth(admin, "ADMIN");
  const response = await admin.request.patch(
    `${origin}/api/transfers/${t.id}`,
    { headers: { Origin: origin }, data: { approval: "REJECTED" } },
  );
  expect(response.status()).toBe(200);
  await page.goto(`/notifications?notification=${n.id}`);
  await expect(
    page.getByText("یادآوری به علت دریافت یا ردشدن ترانسفر متوقف شده است."),
  ).toBeVisible();
  expect(
    (await db.transferNotification.findUniqueOrThrow({ where: { id: n.id } }))
      .acknowledgedAt,
  ).toBeNull();
  await expect(
    page.getByRole("button", { name: "از ترانسفر مطلع شدم", exact: true }),
  ).toHaveCount(0);
  await admin.close();
});

test("permission denial is visible and never removes the durable notification", async ({
  page,
}) => {
  const { n } = await incoming();
  await page.goto(`/notifications?notification=${n.id}`);
  await page.evaluate(() => {
    Notification.requestPermission = async () => "denied";
  });
  await page
    .getByRole("button", { name: "فعال‌کردن اعلان دستگاه", exact: true })
    .click();
  await expect(
    page.getByText(
      "اعلان‌ها مسدودند. مجوز اعلان را در تنظیمات مرورگر و دستگاه فعال کنید و دوباره تلاش کنید.",
    ),
  ).toBeVisible();
  expect(
    (await db.transferNotification.findUniqueOrThrow({ where: { id: n.id } }))
      .acknowledgedAt,
  ).toBeNull();
});

test("all outstanding transfers remain reachable beyond the first page", async ({
  page,
}) => {
  for (let i = 0; i < 21; i++) await incoming();
  await page.goto("/notifications");
  await expect(page.locator(".notification-card")).toHaveCount(20);
  await expect(page.locator(".notification-count")).toHaveText("21");
  await page.getByRole("button", { name: "بعدی", exact: true }).click();
  await expect(page.locator(".notification-card")).toHaveCount(1);
});

test("administrator sees shops with no recipient and overdue transfers", async ({
  page,
  context,
}) => {
  await db.location.upsert({
    where: { id: "notify-empty-shop" },
    create: { id: "notify-empty-shop", name: "Unassigned destination" },
    update: {},
  });
  const { n } = await incoming({
    destinationId: "notify-empty-shop",
    destination: "Unassigned destination",
  });
  await db.transferNotification.update({
    where: { id: n.id },
    data: { createdAt: new Date(Date.now() - 31 * 60_000) },
  });
  await auth(context, "ADMIN");
  await page.goto("/notifications");
  await expect(
    page.getByRole("heading", { name: "Shops needing notification setup" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".notification-warning")
      .filter({ hasText: "Unassigned destination" }),
  ).toContainText("0 active recipients");
  await expect(
    page.getByText(
      "transfers have waited over 30 minutes for acknowledgment.",
      { exact: false },
    ),
  ).toBeVisible();
});

test("Persian notification stays readable on mobile with no clipped text", async ({
  page,
}) => {
  const { n } = await incoming();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/notifications?notification=${n.id}`);
  await expect(page.locator(".notification-full-text")).toContainText(
    "این خط دوم توضیحات است.",
  );
  await expect(page.locator('[lang="fa"]').first()).toHaveAttribute(
    "dir",
    "rtl",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  mkdirSync("output/qa", { recursive: true });
  await expect(page.locator(".notification-card")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "output/qa/notifications-mobile-fa.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "output/qa/notifications-desktop-fa.png",
    fullPage: true,
  });
});

test("scheduled dispatch requires its secret and runs independently of a browser session", async ({
  browser,
}) => {
  const anonymous = await browser.newContext();
  expect(
    (
      await anonymous.request.get(`${origin}/api/notifications/dispatch`)
    ).status(),
  ).toBe(401);
  expect(
    (
      await anonymous.request.get(`${origin}/api/notifications/dispatch`, {
        headers: { Authorization: "Bearer invalid" },
      })
    ).status(),
  ).toBe(401);
  await db.pushSubscription.deleteMany();
  const { n } = await incoming();
  const response = await anonymous.request.get(
    `${origin}/api/notifications/dispatch`,
    { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } },
  );
  expect(response.status()).toBe(200);
  expect((await response.json()).ok).toBe(true);
  expect(
    (await db.transferNotification.findUniqueOrThrow({ where: { id: n.id } }))
      .acknowledgedAt,
  ).toBeNull();
  await anonymous.close();
});
