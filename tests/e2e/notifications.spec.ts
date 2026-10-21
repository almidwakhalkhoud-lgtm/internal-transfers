import { test, expect, type Page, type BrowserContext } from "@playwright/test";
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
  await page.addInitScript(() => {
    Notification.requestPermission = async () => "denied";
  });
  await page.goto(`/notifications?notification=${n.id}`);
  await expect(page).toHaveURL(/\/settings\?tab=notifications&notification=/);
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
  await page
    .getByText("Shops needing notification setup", { exact: true })
    .click();
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

// Exercise browser permission and subscription lifecycle without contacting a Push provider.
declare global {
  interface Window {
    deviceCalls: {
      prompts: number;
      subscriptions: number;
      unsubscribes: number;
    };
  }
}
async function mockDevice(
  page: Page,
  permission: "granted" | "default",
  failSave = false,
) {
  let saved = false;
  let failing = failSave;
  await page.route("**/api/notifications/push{,/**}", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/status"))
      return route.fulfill({ json: { id: saved ? "device-test" : null } });
    if (path.endsWith("/remove")) {
      saved = false;
      return route.fulfill({ json: { ok: true } });
    }
    if (route.request().method() === "POST") {
      if (failing)
        return route.fulfill({
          status: 503,
          json: {
            error: "Could not check notification devices. Please retry.",
          },
        });
      saved = true;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({
      json: {
        publicKey: "AQID",
        devices: saved
          ? [
              {
                id: "device-test",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ]
          : [],
      },
    });
  });
  await page.addInitScript(
    ({ initial }) => {
      window.deviceCalls = { prompts: 0, subscriptions: 0, unsubscribes: 0 };
      let permission = initial;
      Object.defineProperty(Notification, "permission", {
        get: () => permission,
        configurable: true,
      });
      Notification.requestPermission = async () => {
        window.deviceCalls.prompts++;
        permission = "granted";
        return "granted";
      };
      let subscribed = false;
      const sub = {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-device",
        options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer },
        toJSON: () => ({
          endpoint: "https://fcm.googleapis.com/fcm/send/test-device",
          keys: {},
        }),
        unsubscribe: async () => {
          window.deviceCalls.unsubscribes++;
          subscribed = false;
          return true;
        },
      };
      const registration = {
        pushManager: {
          getSubscription: async () => (subscribed ? sub : null),
          subscribe: async () => {
            window.deviceCalls.subscriptions++;
            subscribed = true;
            return sub;
          },
        },
        getNotifications: async () => [],
      };
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          register: async () => registration,
          ready: Promise.resolve(registration),
          getRegistration: async () => registration,
          addEventListener() {},
          removeEventListener() {},
        },
      });
    },
    { initial: permission },
  );
  return {
    recover: () => {
      failing = false;
    },
  };
}

test("settings replaces the navigation item and keeps full transfers collapsed until opened", async ({
  page,
}) => {
  const { t } = await incoming({ count: 35 });
  await incoming();
  await incoming();
  const adminRequests: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/(settings|api-keys)(\?|$)/.test(new URL(r.url()).pathname))
      adminRequests.push(r.url());
  });
  await page.goto("/settings");
  await expect(page.locator(".notification-card")).toHaveCount(3);
  await expect(page.locator("aside a[href='/notifications']")).toHaveCount(0);
  await expect(page.locator("aside a[href='/settings']")).toBeVisible();
  await expect(page.locator(".notification-card[open]")).toHaveCount(0);
  await expect(
    page.getByText("اعلان داخل برنامه برای همه کاربران روشن است."),
  ).toBeVisible();
  const row = page.locator(".notification-card").filter({ hasText: t.number });
  await row.locator("summary").click();
  await expect(row.locator(".notification-full-text")).toBeVisible();
  await expect(row.locator(".notification-full-text")).toContainText(
    "شرح کامل کالای 35",
  );
  await row.locator("summary").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".notification-card[open]")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await expect(page.locator("aside")).toBeHidden();
  await page.screenshot({
    animations: "disabled",
    path: "output/qa/notifications-compact-mobile-fa.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "output/qa/notifications-compact-desktop-fa.png",
    fullPage: true,
  });
  expect(adminRequests).toEqual([]);
  expect((await page.request.get("/api/settings")).status()).toBe(403);
  expect((await page.request.get("/api/api-keys")).status()).toBe(403);
});

test("previously granted permission creates and saves a device automatically and respects an explicit opt-out", async ({
  page,
}) => {
  await mockDevice(page, "granted");
  await page.goto("/settings?tab=notifications");
  await expect(
    page.getByText("این دستگاه ثبت شده است", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.deviceCalls)).toEqual({
    prompts: 0,
    subscriptions: 1,
    unsubscribes: 0,
  });
  await page.getByText(/دستگاه‌ها و راهنما/).click();
  await page.getByRole("button", { name: "حذف دستگاه", exact: true }).click();
  await expect(
    page.getByText("اعلان این دستگاه فعال نیست", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "فعال‌کردن اعلان دستگاه", exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate(() => window.deviceCalls)).toEqual({
    prompts: 0,
    subscriptions: 0,
    unsubscribes: 0,
  });
  await page
    .getByRole("button", { name: "فعال‌کردن اعلان دستگاه", exact: true })
    .click();
  await expect(
    page.getByText("این دستگاه ثبت شده است", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.deviceCalls.prompts)).toBe(0);
});

test("new devices see a single activation button without an automatic permission prompt", async ({
  page,
}) => {
  await mockDevice(page, "default");
  await page.goto("/access");
  const activate = page.getByRole("button", {
    name: "فعال‌کردن اعلان دستگاه",
    exact: true,
  });
  await expect(activate).toBeEnabled();
  expect(await page.evaluate(() => window.deviceCalls)).toEqual({
    prompts: 0,
    subscriptions: 0,
    unsubscribes: 0,
  });
  await activate.click();
  await expect(page.locator(".notification-activation")).toHaveCount(0);
  expect(await page.evaluate(() => window.deviceCalls)).toEqual({
    prompts: 1,
    subscriptions: 1,
    unsubscribes: 0,
  });
  await page.locator("aside a[href='/settings']").click();
  await expect(
    page.getByText("این دستگاه ثبت شده است", { exact: true }),
  ).toBeVisible();
});

test("failed device persistence is visible and reconnect retries without asking permission again", async ({
  page,
}) => {
  const device = await mockDevice(page, "granted", true);
  await page.goto("/settings?tab=notifications");
  await expect(page.locator(".notification-settings .error")).toBeVisible();
  await expect(
    page.getByText("این دستگاه ثبت شده است", { exact: true }),
  ).toHaveCount(0);
  device.recover();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByText("این دستگاه ثبت شده است", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.deviceCalls.prompts)).toBe(0);
});

test("administrator general settings remain separate from notification settings", async ({
  page,
  context,
}) => {
  await auth(context, "ADMIN");
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Numbering sequence", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".notification-settings")).toHaveCount(0);
  await page
    .locator(".settings-tabs")
    .getByRole("link", { name: "Notifications", exact: true })
    .click();
  await expect(
    page.getByText("Notification delivery", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Numbering sequence", exact: true }),
  ).toHaveCount(0);
});
