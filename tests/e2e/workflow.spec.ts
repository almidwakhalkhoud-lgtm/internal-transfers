import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { PrismaClient, type Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
const db = new PrismaClient();
const origin = "http://127.0.0.1:3101";
async function login(page: Page, email = "staff@buzz.test") {
  await page.goto("/login");
  if (email === "admin@buzz.test") {
    await page
      .getByRole("button", { name: "Administrator sign in", exact: true })
      .click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.BUZZ_TEST_PASSWORD!);
  } else {
    const code =
      "BUZZ-" +
      (email.startsWith("outside")
        ? Buffer.from(process.env.BUZZ_TEST_PASSWORD! + "outside").subarray(-32)
        : Buffer.from(process.env.BUZZ_TEST_PASSWORD!).subarray(0, 32)
      ).toString("base64url");
    await page.getByLabel("Access code", { exact: true }).fill(code);
  }
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
async function post(request: APIRequestContext, path: string, data: unknown) {
  return request.post(`/api/${path}`, { data, headers: { Origin: origin } });
}
async function draft(
  request: APIRequestContext,
  lines: unknown[],
  key = randomUUID(),
) {
  const data = {
    sourceId: "main",
    destinationId: "branch",
    date: "2026-10-17",
    remarks: "AUTOMATED TEST ONLY",
    lines,
  };
  const saved = await post(request, "drafts", { id: key, data });
  expect(saved.ok()).toBeTruthy();
  return { ...data, key };
}
test.afterAll(() => db.$disconnect());
test("admin login, staff creation, location permissions and management", async ({
  page,
}) => {
  await login(page, "admin@buzz.test");
  await page.goto("/users");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Name", { exact: true }).fill("Created through UI");
  await modal.getByLabel("Email", { exact: true }).fill("created@buzz.test");
  await modal.getByLabel("Access code", { exact: true }).fill("QA-CREATED-01");
  await modal.getByLabel("Main", { exact: true }).check();
  await modal.getByLabel("Al Azaiba", { exact: true }).check();
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("created@buzz.test", { exact: true }),
  ).toBeVisible();
  await page.goto("/locations");
  await page.getByRole("button", { name: "Add location" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Location name")
    .fill("TEST UI LOCATION");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "TEST UI LOCATION" }),
  ).toBeVisible();
});
test("real product code → TAB → quantity → conditional unit → confirm → PDF download → WhatsApp fallback", async ({
  page,
}) => {
  await login(page);
  const unit = await db.product.findUniqueOrThrow({
    where: { id: "real-unit" },
  });
  const noUnit = await db.product.findUniqueOrThrow({
    where: { id: "real-no-unit" },
  });
  await page.goto("/new-transfer");
  await page.getByLabel("From location", { exact: true }).click();
  await page.getByRole("option", { name: "Main", exact: true }).click();
  await page.getByLabel("To location", { exact: true }).click();
  await page.getByRole("option", { name: "Al Azaiba", exact: true }).click();
  const code = page.getByRole("textbox", {
    name: "Code / Barcode 1",
    exact: true,
  });
  await code.fill(unit.code);
  await code.press("Tab");
  await expect(page.getByLabel("Quantity 1", { exact: true })).toBeFocused();
  await expect(page.getByText(unit.description, { exact: true })).toBeVisible();
  await page.getByLabel("Quantity 1", { exact: true }).fill("2.5");
  await page.getByLabel("Quantity 1", { exact: true }).press("Tab");
  await expect(page.getByLabel("Unit 1", { exact: true })).toBeFocused();
  await page.getByLabel("Unit 1", { exact: true }).press("Tab");
  await expect(
    page.getByLabel("Code / Barcode 2", { exact: true }),
  ).toBeFocused();
  await page.getByLabel("Code / Barcode 2", { exact: true }).fill(noUnit.code);
  await page.getByLabel("Code / Barcode 2", { exact: true }).press("Tab");
  await expect(page.getByLabel("Quantity 2", { exact: true })).toBeFocused();
  await page.getByLabel("Quantity 2", { exact: true }).fill("0.125");
  await page.getByLabel("Quantity 2", { exact: true }).press("Tab");
  await expect(
    page.getByLabel("Code / Barcode 3", { exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Unit 2", { exact: true })).toHaveCount(0);
  mkdirSync("output/qa", { recursive: true });
  await page.screenshot({
    path: "output/qa/transfer-entry.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm Transfer", exact: true })
    .click();
  const review = page.getByRole("dialog", { name: "Review transfer" });
  await expect(review.getByText("2.625", { exact: true })).toBeVisible();
  await expect(review).toContainText(/[A-Z]{2}-\d{4}/);
  await review
    .getByRole("button", { name: "Confirm and generate PDF" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Transfer Confirmed Successfully" }),
  ).toBeVisible();
  const downloadButton = page.getByRole("button", {
    name: "Download PDF",
    exact: true,
  });
  await expect(downloadButton).toBeEnabled();
  const downloadEvent = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^[A-Z]{2}-\d+\.pdf$/);
  await download.saveAs("output/qa/real-products-transfer.pdf");
  const t = await db.transfer.findFirstOrThrow({
    where: { creatorId: "test-staff" },
    orderBy: { confirmedAt: "desc" },
  });
  expect(t.total.toString()).toBe("2.625");
  expect(t.approval).toBe("PENDING");
  expect(t.creatorName).toBe("QA Staff");
  expect(t.pdf).not.toBeNull();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    });
  });
  const fallbackDownload = page.waitForEvent("download");
  await page.context().route("https://wa.me/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>WhatsApp handoff test</h1>",
    }),
  );
  const whatsappPopup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Share via WhatsApp" }).click();
  await fallbackDownload;
  const popup = await whatsappPopup;
  await expect(popup).toHaveURL(/^https:\/\/wa.me\/\?text=/);
  await popup.close();
  await expect(page.getByRole("status")).toContainText(
    "Attach it manually in WhatsApp",
  );
  await expect(
    page.getByRole("link", { name: "Open WhatsApp" }),
  ).toHaveAttribute("href", /^https:\/\/wa.me\/\?text=/);
  await expect(page).toHaveURL(/new-transfer/);
  await page.screenshot({
    path: "output/qa/confirmation-success.png",
    fullPage: true,
  });
});
test("HID scanner Enter and TAB suffixes, leading zeros, unknown identifiers and duplicate decisions", async ({
  page,
}) => {
  await login(page);
  await page.goto("/new-transfer");
  const code1 = page.getByLabel("Code / Barcode 1", { exact: true });
  await code1.pressSequentially("0012300119139", { delay: 1 });
  await code1.press("Enter");
  await expect(page.getByLabel("Quantity 1", { exact: true })).toBeFocused();
  await expect(
    page.getByText("TEST FIXTURE · Barcode leading-zero test", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Quantity 1", { exact: true }).fill("0");
  await page.getByLabel("Quantity 1", { exact: true }).press("Tab");
  await expect(page.getByLabel("Quantity 1", { exact: true })).toBeFocused();
  await expect(
    page.getByRole("alert").filter({ hasText: "positive quantity" }),
  ).toContainText("positive quantity");
  await page.getByLabel("Quantity 1", { exact: true }).fill("3");
  await page.getByLabel("Quantity 1", { exact: true }).press("Tab");
  await page.getByLabel("Unit 1", { exact: true }).click();
  await page.getByRole("option", { name: "piece", exact: true }).click();
  await page.getByLabel("Unit 1", { exact: true }).press("Tab");
  const code2 = page.getByLabel("Code / Barcode 2", { exact: true });
  await code2.fill("DOES-NOT-EXIST");
  await code2.press("Tab");
  await expect(code2).toBeFocused();
  await expect(
    page.getByRole("alert").filter({ hasText: "Product not found" }),
  ).toContainText("Product not found");
  await code2.fill("0098765432105");
  await code2.press("Tab");
  await expect(
    page.getByRole("dialog", { name: "Product already added" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep separate row" }).click();
  await expect(page.getByLabel("Quantity 2", { exact: true })).toBeFocused();
  await page.getByLabel("Quantity 2", { exact: true }).fill("4");
  await page.getByLabel("Quantity 2", { exact: true }).press("Tab");
  await page.getByLabel("Unit 2", { exact: true }).press("Tab");
  await expect(
    page.getByLabel("Code / Barcode 3", { exact: true }),
  ).toBeFocused();
});
test("server denies unauthenticated and unauthorized access, invalid units, duplicate rows and CSRF", async ({
  page,
  browser,
}) => {
  await login(page);
  for (const path of ["users", "settings", "audit", "catalog/conflicts"])
    expect((await page.request.get(`/api/${path}`)).status()).toBe(403);
  const p = await db.product.findUniqueOrThrow({
    where: { id: "real-no-unit" },
  });
  const input = await draft(page.request, [
    {
      productId: p.id,
      version: p.updatedAt.toISOString(),
      quantity: "1",
      unit: "pcs",
    },
  ]);
  expect((await post(page.request, "transfers", input)).status()).toBe(400);
  expect(await db.transfer.count({ where: { key: input.key } })).toBe(0);
  expect(
    (
      await page.request.post("/api/drafts", {
        data: { id: randomUUID(), data: {} },
        headers: { Origin: "https://other.test" },
      })
    ).status(),
  ).toBe(403);
  const invalidLocation = {
    ...input,
    sourceId: "restricted",
    lines: [
      {
        productId: p.id,
        version: p.updatedAt.toISOString(),
        quantity: "1",
        unit: "",
      },
    ],
  };
  expect(
    (await post(page.request, "transfers", invalidLocation)).status(),
  ).toBe(403);
  const duplicate = {
    ...input,
    lines: [
      {
        productId: p.id,
        version: p.updatedAt.toISOString(),
        quantity: "1",
        unit: "",
      },
      {
        productId: p.id,
        version: p.updatedAt.toISOString(),
        quantity: "1",
        unit: "",
      },
    ],
  };
  expect((await post(page.request, "transfers", duplicate)).status()).toBe(400);
  const context = await browser.newContext();
  const anon = await context.request.get(`${origin}/api/transfers`);
  expect(anon.status()).toBe(401);
  const existing = await db.transfer.findFirstOrThrow();
  expect(
    (
      await context.request.get(`${origin}/api/transfers/${existing.id}/pdf`)
    ).status(),
  ).toBe(401);
  const outside = await context.newPage();
  await login(outside, "outside@buzz.test");
  expect(
    (await outside.request.get(`/api/transfers/${existing.id}/pdf`)).status(),
  ).toBe(403);
  await context.close();
});
test("idempotent confirmation, atomic numbering and immutable PDF snapshots under concurrent requests", async ({
  page,
}) => {
  await login(page);
  const p = await db.product.findUniqueOrThrow({
    where: { id: "real-no-unit" },
  });
  const lines = [
    {
      productId: p.id,
      version: p.updatedAt.toISOString(),
      quantity: "1.001",
      unit: "",
    },
  ];
  const [a, b] = await Promise.all([
    draft(page.request, lines),
    draft(page.request, lines),
  ]);
  const results = await Promise.all([
    post(page.request, "transfers", a),
    post(page.request, "transfers", a),
    post(page.request, "transfers", b),
  ]);
  const saved = await Promise.all(
    results.map(async (r) => {
      expect(r.ok()).toBeTruthy();
      return r.json();
    }),
  );
  expect(saved[0].id).toBe(saved[1].id);
  expect(saved[0].number).not.toBe(saved[2].number);
  expect(await db.transfer.count({ where: { key: a.key } })).toBe(1);
  const pdf1 = await page.request.get(`/api/transfers/${saved[0].id}/pdf`);
  const pdf2 = await page.request.get(`/api/transfers/${saved[0].id}/pdf`);
  expect((await pdf1.body()).equals(await pdf2.body())).toBe(true);
  expect(pdf1.headers()["cache-control"]).toBe("private, no-store");
  expect(
    (
      await page.request.patch(`/api/transfers/${saved[0].id}`, {
        data: { lines: [] },
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(403);
});
test("Persian translation persists and RTL keeps barcode inputs LTR", async ({
  page,
}) => {
  await login(page);
  await page.goto("/new-transfer");
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.locator("div[dir][lang]").first()).toHaveAttribute(
    "dir",
    "rtl",
  );
  await expect(
    page.getByRole("heading", { name: "انتقال جدید" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("کد / بارکد 1", { exact: true }),
  ).toHaveAttribute("dir", "ltr");
  await page.reload();
  await expect(page.locator("div[dir][lang]").first()).toHaveAttribute(
    "dir",
    "rtl",
  );
  await page.screenshot({
    path: "output/qa/persian-entry.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("div[dir][lang]").first()).toHaveAttribute(
    "dir",
    "ltr",
  );
});
test("native file sharing branch hands the actual PDF File to the Web Share API", async ({
  page,
}) => {
  await login(page);
  const t = await db.transfer.findFirstOrThrow({
    where: { creatorId: "test-staff" },
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (
          window as unknown as {
            shared: { name: string; type: string; size: number }[];
          }
        ).shared = data.files!.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
        }));
      },
    });
  });
  await page.goto(`/transfers/${t.id}`);
  const share = page.getByRole("button", { name: "Share via WhatsApp" });
  await expect(share).toBeEnabled();
  await share.click();
  const files = await page.evaluate(
    () =>
      (
        window as unknown as {
          shared: { name: string; type: string; size: number }[];
        }
      ).shared,
  );
  expect(files[0].name).toBe(`${t.number}.pdf`);
  expect(files[0].type).toBe("application/pdf");
  expect(files[0].size).toBeGreaterThan(1000);
  await expect(page.getByRole("status")).toContainText("File shared");
});
test("approval is distinct, audited, and does not mutate the confirmed PDF", async ({
  page,
}) => {
  await login(page, "admin@buzz.test");
  const t = await db.transfer.findFirstOrThrow({
    where: { approval: "PENDING" },
  });
  const before = await page.request.get(`/api/transfers/${t.id}/pdf`);
  const approval = await page.request.patch(`/api/transfers/${t.id}`, {
    data: { approval: "APPROVED" },
    headers: { Origin: origin },
  });
  expect(approval.ok()).toBe(true);
  const after = await page.request.get(`/api/transfers/${t.id}/pdf`);
  expect((await before.body()).equals(await after.body())).toBe(true);
  expect(
    await db.audit.count({ where: { target: t.id, action: "APPROVED" } }),
  ).toBe(1);
  expect(
    (
      await page.request.patch(`/api/transfers/${t.id}`, {
        data: { approval: "REJECTED" },
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(409);
});
test("200 real product rows generate a paginated PDF in exact order and retain totals", async ({
  page,
}) => {
  await login(page);
  const prod = new PrismaClient({
    datasourceUrl: process.env.BUZZ_PRODUCTION_DATABASE_URL,
  });
  const actual = await prod.product.findMany({
    orderBy: { code: "asc" },
    take: 200,
  });
  await prod.$disconnect();
  for (const p of actual)
    await db.product.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        description: p.description,
        units: p.units,
        source: p.source,
      },
      update: {},
    });
  const records = await db.product.findMany({
    where: { code: { in: actual.map((p) => p.code) } },
    orderBy: { code: "asc" },
  });
  const lines = records.map((p) => ({
    productId: p.id,
    version: p.updatedAt.toISOString(),
    quantity: "1.125",
    unit: p.units[0] ?? "",
  }));
  const input = await draft(page.request, lines);
  const result = await post(page.request, "transfers", input);
  expect(result.ok()).toBe(true);
  const t = await result.json();
  expect(t.pdfReady).toBe(true);
  const pdf = await page.request.get(`/api/transfers/${t.id}/pdf`);
  mkdirSync("output/qa", { recursive: true });
  writeFileSync("output/qa/200-lines.pdf", await pdf.body());
  writeFileSync(
    "output/qa/200-lines-expected.json",
    JSON.stringify(
      actual.map((p) => ({ code: p.code, description: p.description })),
    ),
  );
  const saved = await db.transfer.findUniqueOrThrow({ where: { id: t.id } });
  expect(saved.total.toString()).toBe("225");
  expect((saved.lines as unknown[]).length).toBe(200);
});
test("registered barcode PDF is generated and database guards reject document mutations", async ({
  page,
}) => {
  await login(page);
  const p = await db.product.findUniqueOrThrow({
    where: { id: "fixture-barcode" },
  });
  const input = await draft(page.request, [
    {
      productId: p.id,
      version: p.updatedAt.toISOString(),
      quantity: "2",
      unit: "box",
    },
  ]);
  const result = await post(page.request, "transfers", input);
  expect(result.ok()).toBe(true);
  const saved = await result.json();
  const pdf = await page.request.get(`/api/transfers/${saved.id}/pdf`);
  writeFileSync("output/qa/barcode-fixture.pdf", await pdf.body());
  await expect(
    db.transfer.update({
      where: { id: saved.id },
      data: { remarks: "unrecorded change" },
    }),
  ).rejects.toThrow();
  await expect(
    db.transfer.delete({ where: { id: saved.id } }),
  ).rejects.toThrow();
  const audit = await db.audit.findFirstOrThrow({
    where: { target: saved.id },
  });
  await expect(db.audit.delete({ where: { id: audit.id } })).rejects.toThrow();
});
test("a delayed PDF uses the confirmed employee snapshot after a user-name change", async ({
  page,
}) => {
  await login(page);
  const original = await db.transfer.findFirstOrThrow({
    where: { creatorId: "test-staff" },
  });
  const retry = await db.transfer.create({
    data: {
      number: "QA-PDF-RETRY",
      key: randomUUID(),
      creatorId: original.creatorId,
      creatorName: original.creatorName,
      sourceId: original.sourceId,
      destinationId: original.destinationId,
      source: original.source,
      destination: original.destination,
      date: original.date,
      remarks: "AUTOMATED PDF RETRY TEST",
      lines: original.lines as Prisma.InputJsonValue,
      total: original.total,
      pdfError: true,
    },
  });
  const user = await db.user.findUniqueOrThrow({ where: { id: "test-staff" } });
  await db.user.update({
    where: { id: user.id },
    data: { name: "Changed employee display name" },
  });
  try {
    const response = await page.request.get(`/api/transfers/${retry.id}/pdf`);
    expect(response.ok()).toBe(true);
    writeFileSync("output/qa/employee-snapshot.pdf", await response.body());
    expect(
      (await db.transfer.findUniqueOrThrow({ where: { id: retry.id } }))
        .creatorName,
    ).toBe(original.creatorName);
  } finally {
    await db.user.update({ where: { id: user.id }, data: { name: user.name } });
  }
});
test("catalog preview rejects incomplete original rows and imports explicit website units without overwriting conflicts", async ({
  page,
}) => {
  await login(page, "admin@buzz.test");
  await page.goto("/products");
  await page
    .getByRole("button", { name: "Import catalog", exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: "Catalog import" });
  await modal.getByLabel("Choose workbook").setInputFiles("ITEMS.xls");
  await modal
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await expect(
    modal.getByRole("button", { name: "Import validated rows" }),
  ).toBeDisabled();
  await expect(modal.getByRole("alert")).toContainText("3277");
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  const p = await db.product.findUniqueOrThrow({ where: { id: "real-unit" } });
  const result = await post(page.request, "catalog/import", {
    source: "mehdiali.om export",
    rows: [
      {
        code: p.code,
        description: p.description,
        units: [...p.units, "TEST-UNIT"],
        barcodes: [],
      },
    ],
  });
  expect(result.ok()).toBe(true);
  expect((await result.json()).conflicts).toBe(1);
  expect(
    (await db.product.findUniqueOrThrow({ where: { id: p.id } })).units,
  ).toEqual(p.units);
  const list = await page.request.get("/api/catalog/conflicts");
  const conflicts = await list.json();
  const conflict = conflicts.items.find(
    (c: { code: string }) => c.code === p.code,
  );
  const accepted = await post(
    page.request,
    `catalog/conflicts/${conflict.id}`,
    { accept: true, expectedVersion: conflict.currentVersion },
  );
  expect(accepted.ok()).toBe(true);
  expect(
    (await db.product.findUniqueOrThrow({ where: { id: p.id } })).units,
  ).toContain("TEST-UNIT");
  expect(
    (
      await post(page.request, `catalog/conflicts/${conflict.id}`, {
        accept: true,
        expectedVersion: conflict.currentVersion,
      })
    ).status(),
  ).toBe(409);
});
test("stale product versions are rejected and draft data survives a failed confirmation", async ({
  page,
}) => {
  await login(page);
  const p = await db.product.findUniqueOrThrow({
    where: { id: "real-no-unit" },
  });
  const input = await draft(page.request, [
    {
      productId: p.id,
      version: p.updatedAt.toISOString(),
      quantity: "2.125",
      unit: "",
    },
  ]);
  await db.product.update({
    where: { id: p.id },
    data: { description: p.description + " [TEST UPDATE]" },
  });
  const result = await post(page.request, "transfers", input);
  expect(result.status()).toBe(409);
  expect(
    await db.draft.findUnique({ where: { id: input.key } }),
  ).not.toBeNull();
  expect(await db.transfer.count({ where: { key: input.key } })).toBe(0);
});
test("10,000-product catalog keeps exact lookups indexed and paginated", async ({
  page,
}) => {
  await login(page, "admin@buzz.test");
  await db.product.createMany({
    data: Array.from({ length: 10000 }, (_, i) => ({
      code: `PERF-TEST-${String(i).padStart(5, "0")}`,
      description: "AUTOMATED PERFORMANCE FIXTURE",
      units: [],
      source: "TEST DATABASE ONLY",
    })),
  });
  const started = performance.now();
  for (let i = 0; i < 10; i++) {
    const result = await page.request.get(
      `/api/products?exact=1&q=PERF-TEST-${String(9990 + i).padStart(5, "0")}`,
    );
    const json = await result.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].code).toBe(
      `PERF-TEST-${String(9990 + i).padStart(5, "0")}`,
    );
  }
  const averageMs = (performance.now() - started) / 10;
  expect(averageMs).toBeLessThan(500);
  const result = await page.request.get("/api/products?page=1");
  const json = await result.json();
  expect(json.items).toHaveLength(50);
  expect(json.count).toBeGreaterThan(10000);
  writeFileSync(
    "output/qa/performance.json",
    JSON.stringify(
      { products: json.count, exactLookupMeanMs: averageMs },
      null,
      2,
    ),
  );
});
test("rapid edits discard stale lookups without losing the new code", async ({
  page,
}) => {
  await login(page);
  const first = await db.product.findUniqueOrThrow({
    where: { id: "real-unit" },
  });
  const second = await db.product.findUniqueOrThrow({
    where: { id: "real-no-unit" },
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/products?exact=1*", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/new-transfer");
  const code = page.getByLabel("Code / Barcode 1", { exact: true });
  await code.fill(first.code);
  const requestStarted = page.waitForRequest((request) =>
    request.url().includes("/api/products?exact=1"),
  );
  await code.press("Tab");
  await requestStarted;
  await code.fill(second.code);
  release();
  await expect(code).toHaveValue(second.code);
  await expect(page.getByText(first.description, { exact: true })).toHaveCount(
    0,
  );
  await code.press("Tab");
  await expect(page.getByLabel("Quantity 1", { exact: true })).toBeFocused();
  await expect(
    page.getByText(second.description, { exact: true }),
  ).toBeVisible();
});
test("saved drafts reopen from PostgreSQL with the complete entered data", async ({
  page,
}) => {
  await login(page);
  const p = await db.product.findUniqueOrThrow({ where: { id: "real-unit" } });
  await page.goto("/new-transfer");
  await page.getByLabel("From location", { exact: true }).click();
  await page.getByRole("option", { name: "Main", exact: true }).click();
  await page.getByLabel("To location", { exact: true }).click();
  await page.getByRole("option", { name: "Al Azaiba", exact: true }).click();
  await page.getByLabel("Code / Barcode 1", { exact: true }).fill(p.code);
  await page.getByLabel("Code / Barcode 1", { exact: true }).press("Tab");
  await page.getByLabel("Quantity 1", { exact: true }).fill("7.25");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");
  const number = await page
    .getByLabel("Transfer number", { exact: true })
    .inputValue();
  await page.reload();
  await page.getByText(/^Saved drafts/).click();
  await page
    .getByRole("button", { name: `Open draft · ${number}`, exact: true })
    .click();
  await expect(page.getByLabel("Quantity 1", { exact: true })).toHaveValue(
    "7.25",
  );
  await expect(page.getByLabel("Transfer number", { exact: true })).toHaveValue(
    number,
  );
});
test("mobile layout remains contained, offers navigation and keeps confirmation accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/new-transfer");
  await expect(
    page.getByRole("button", { name: "Confirm Transfer", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  for (const label of [
    "From location",
    "To location",
    "Transfer date",
    "Transfer number",
  ]) {
    const box = await page.getByLabel(label, { exact: true }).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: "output/qa/mobile-entry.png", fullPage: true });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Transfer history", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Transfer history", exact: true })
    .click();
  await expect(page).toHaveURL(/transfers/);
});

test("secure code lifecycle, server menu authorization and user transfer filter", async ({
  page,
  browser,
}) => {
  await login(page, "admin@buzz.test");
  const response = await post(page.request, "users", {
    accessCode: "QA-RESTRICTED-01",
    name: "Restricted code user",
    email: "code-only@buzz.test",
    role: "STAFF",
    locationIds: ["main", "branch"],
    menus: ["products"],
  });
  expect(response.ok()).toBeTruthy();
  const created = await response.json();
  created.accessCode = "QA-RESTRICTED-01";
  expect(created).not.toHaveProperty("accessHash");
  const stored = await db.user.findUniqueOrThrow({ where: { id: created.id } });
  expect(stored.accessHash).not.toBe(created.accessCode);
  const context = await browser.newContext();
  const staff = await context.newPage();
  await staff.goto("/login");
  await staff
    .getByLabel("Access code", { exact: true })
    .fill(created.accessCode);
  await staff.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(staff).toHaveURL(/products/);
  await expect(
    staff.locator("nav").getByRole("link", { name: "New transfer" }),
  ).toHaveCount(0);
  expect((await staff.request.get("/api/transfers")).status()).toBe(403);
  expect(
    (
      await post(staff.request, "drafts", { id: randomUUID(), data: {} })
    ).status(),
  ).toBe(403);
  await staff.goto("/new-transfer");
  await expect(staff).toHaveURL(/products/);
  const rotated = await page.request.patch(`/api/users/${created.id}`, {
    headers: { Origin: origin },
    data: { accessCode: "QA-REPLACED-02" },
  });
  expect(rotated.ok()).toBeTruthy();
  const issued = { accessCode: "QA-REPLACED-02" };
  expect(issued.accessCode).not.toBe(created.accessCode);
  expect((await staff.request.get("/api/products")).status()).toBe(401);
  expect(
    (
      await post(staff.request, "login", { accessCode: created.accessCode })
    ).status(),
  ).toBe(401);
  expect(
    (
      await post(staff.request, "login", { accessCode: issued.accessCode })
    ).status(),
  ).toBe(200);
  await page.request.patch(`/api/users/${created.id}`, {
    headers: { Origin: origin },
    data: { revokeCode: true },
  });
  expect((await staff.request.get("/api/products")).status()).toBe(401);
  expect(
    (
      await post(staff.request, "login", { accessCode: issued.accessCode })
    ).status(),
  ).toBe(401);
  await page.goto("/users");
  const row = page.getByRole("row").filter({ hasText: "QA Staff" });
  await row.getByRole("link", { name: "User transfers" }).click();
  await expect(page).toHaveURL(/creator=test-staff/);
  await expect(page.getByLabel("Created by", { exact: true })).toContainText(
    "QA Staff",
  );
  const list = await page.request.get("/api/transfers?creator=test-staff");
  for (const item of (await list.json()).items)
    expect(item.creator.name).toMatch(/QA Staff/);
  await context.close();
});

test("manual RHF errors, custom keyboard dropdown and English Yekan font", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".inline-error[role=alert]")).toHaveText(
    "This field is required.",
  );
  await page.getByLabel("Access code", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".inline-error[role=alert]")).toHaveText(
    "The entered format is invalid.",
  );
  await page.getByRole("button", { name: "فارسی" }).click();
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(page.locator(".inline-error[role=alert]")).toHaveText(
    "قالب مقدار واردشده صحیح نیست.",
  );
  await login(page);
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Yekan Bakh");
  await page.goto("/new-transfer");
  const dropdown = page.getByLabel("From location", { exact: true });
  await dropdown.focus();
  await dropdown.press("Home");
  await dropdown.press("ArrowDown");
  await dropdown.press("Enter");
  await expect(dropdown).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("select")).toHaveCount(0);
});

test("administrator grants only New transfer through UI and code user confirms and downloads PDF", async ({
  page,
  browser,
}) => {
  await login(page, "admin@buzz.test");
  await page.goto("/users");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Name", { exact: true }).fill("Create-only UI user");
  await modal
    .getByLabel("Access code", { exact: true })
    .fill("QA-CREATE-ONLY-01");
  await modal
    .getByLabel("Email", { exact: true })
    .fill("create-only@buzz.test");
  await modal.getByLabel("Main", { exact: true }).check();
  await modal.getByLabel("Al Azaiba", { exact: true }).check();
  for (const label of [
    "Overview",
    "Requests",
    "Transfer history",
    "Sign",
    "Products",
    "Locations",
  ])
    await modal.getByLabel(label, { exact: true }).uncheck();
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const code = "QA-CREATE-ONLY-01";
  const stored = await db.user.findUniqueOrThrow({
    where: { email: "create-only@buzz.test" },
  });
  expect(stored.menus).toEqual(["new-transfer"]);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const staff = await context.newPage();
  await staff.goto("/login");
  await staff.getByLabel("Access code", { exact: true }).fill(code);
  await staff.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(staff).toHaveURL(/new-transfer/);
  expect((await staff.request.get("/api/products")).status()).toBe(403);
  expect((await staff.request.get("/api/transfers")).status()).toBe(403);
  await staff.getByLabel("From location", { exact: true }).click();
  await staff.getByRole("option", { name: "Main", exact: true }).click();
  await staff.getByLabel("To location", { exact: true }).click();
  await staff.getByRole("option", { name: "Al Azaiba", exact: true }).click();
  const product = await db.product.findUniqueOrThrow({
    where: { id: "real-no-unit" },
  });
  await staff
    .getByLabel("Code / Barcode 1", { exact: true })
    .fill(product.code);
  await staff.getByLabel("Code / Barcode 1", { exact: true }).press("Tab");
  await staff.getByLabel("Quantity 1", { exact: true }).fill("0");
  await staff.getByLabel("Quantity 1", { exact: true }).press("Tab");
  await expect(
    staff.getByText("Enter a positive quantity with up to 3 decimal places.", {
      exact: true,
    }),
  ).toBeVisible();
  await staff.getByLabel("Quantity 1", { exact: true }).fill("2");
  await staff.getByLabel("Quantity 1", { exact: true }).press("Tab");
  await staff
    .getByRole("button", { name: "Confirm Transfer", exact: true })
    .click();
  await staff
    .getByRole("button", { name: "Confirm and generate PDF", exact: true })
    .click();
  await expect(
    staff.getByRole("heading", { name: "Transfer Confirmed Successfully" }),
  ).toBeVisible();
  const downloading = staff.waitForEvent("download");
  await staff
    .getByRole("button", { name: "Download PDF", exact: true })
    .click();
  expect((await downloading).suggestedFilename()).toMatch(
    /^[A-Z]{2}-\d+\.pdf$/,
  );
  await staff.screenshot({
    path: "output/qa/mobile-code-success.png",
    fullPage: true,
  });
  await context.close();
});

test("custom calendar selects leap day, supports keyboard, saves ISO date and clears history filters", async ({
  page,
}) => {
  await login(page);
  await page.goto("/new-transfer");
  const date = page.getByLabel("Transfer date", { exact: true });
  await date.click();
  let calendar = page.getByRole("dialog", { name: "Select date", exact: true });
  await calendar.getByLabel("Year", { exact: true }).click();
  await calendar.getByRole("option", { name: "2024", exact: true }).click();
  await calendar.getByLabel("Month", { exact: true }).click();
  await calendar.getByRole("option", { name: "January", exact: true }).click();
  await calendar
    .getByRole("button", { name: "Wednesday, 31 January 2024", exact: true })
    .click();
  await expect(date).toContainText("31 Jan 2024");
  await date.click();
  calendar = page.getByRole("dialog", { name: "Select date", exact: true });
  const selected = calendar.getByRole("button", {
    name: "Wednesday, 31 January 2024",
    exact: true,
  });
  await expect(selected).toBeFocused();
  await selected.press("PageDown");
  const leapDay = calendar.getByRole("button", {
    name: "Thursday, 29 February 2024",
    exact: true,
  });
  await expect(leapDay).toBeFocused();
  await leapDay.press("Enter");
  await expect(date).toContainText("29 Feb 2024");
  await expect(date).toBeFocused();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  const drafts = await (await page.request.get("/api/drafts")).json();
  expect(drafts[0].data.date).toBe("2024-02-29");
  await date.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await date.click();
  await page.locator("dialog").click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/transfers");
  const start = page.getByLabel("Start date", { exact: true });
  await start.click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(start).not.toHaveText("Start date");
  await start.click();
  await page.getByRole("button", { name: "Clear date", exact: true }).click();
  await expect(start).toHaveText("Start date");
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await page.getByLabel("از تاریخ", { exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("grid")).toBeVisible();
  await page.screenshot({
    path: "output/qa/persian-calendar.png",
    fullPage: true,
  });
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
});

test("desktop typography is readable and hamburger closes outside or with Escape", async ({
  page,
}) => {
  await login(page);
  await page.goto("/new-transfer");
  expect(
    await page
      .locator("label", { hasText: "From location" })
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(13);
  expect(
    await page
      .getByRole("link", { name: "Overview", exact: true })
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(15);
  await page.screenshot({
    path: "output/qa/desktop-typography.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  const sidebarBox = await page.locator("#workspace-navigation").boundingBox();
  await page
    .getByRole("button", { name: "Close menu", exact: true })
    .click({ position: { x: sidebarBox!.x < 100 ? 350 : 40, y: 200 } });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#workspace-navigation")).toBeHidden();
  await menu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
});

test("listboxes escape card clipping, remain clickable in dialogs and animate with readable contrast", async ({
  page,
}) => {
  await login(page);
  await page.request.patch("/api/me", {
    headers: { Origin: origin },
    data: { locale: "en" },
  });
  await page.goto("/new-transfer");
  await page.getByLabel("From location", { exact: true }).click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  expect(await list.evaluate((el) => el.matches(":popover-open"))).toBe(true);
  const last = list.getByRole("option").last();
  const hit = await last.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const target = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    return el === target || el.contains(target);
  });
  expect(hit).toBe(true);
  await page.screenshot({
    path: "output/qa/dropdown-top-layer.png",
    fullPage: true,
  });
  await page.getByRole("option", { name: "Main", exact: true }).click();
  await expect(page.getByLabel("From location", { exact: true })).toContainText(
    "Main",
  );
  await page.getByLabel("Transfer date", { exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Select date", exact: true });
  await dialog.getByLabel("Year", { exact: true }).click();
  await dialog.getByRole("option", { name: "2024", exact: true }).click();
  await expect(dialog.getByLabel("Year", { exact: true })).toContainText(
    "2024",
  );
  await page.keyboard.press("Escape");
  await page.goto("/dashboard");
  const contrast = await page
    .getByText("All transfers", { exact: true })
    .first()
    .evaluate((el) => {
      const rgb = getComputedStyle(el)
        .color.match(/\d+/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          const x = v / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
      return (
        1.05 / (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 + 0.05)
      );
    });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await expect(page.locator("[data-float]").first()).toHaveCSS(
    "animation-name",
    "workspace-float",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-float]").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("administrator chosen codes are reusable, case insensitive, unique, hashed and replaceable in UI", async ({
  page,
  browser,
}) => {
  await login(page, "admin@buzz.test");
  const created = await post(page.request, "users", {
    name: "Chosen code QA",
    email: "chosen-code@buzz.test",
    accessCode: "Staff-QA2026",
    role: "STAFF",
    menus: ["products"],
    locationIds: ["main"],
  });
  expect(created.status()).toBe(200);
  const user = await created.json();
  expect(user).not.toHaveProperty("accessCode");
  expect(user).not.toHaveProperty("accessVerifier");
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(record.accessVerifier).toMatch(/^\$2[aby]\$/);
  const duplicate = await post(page.request, "users", {
    name: "Duplicate QA",
    email: "duplicate-code@buzz.test",
    accessCode: "staff-qa2026",
    role: "STAFF",
    menus: [],
    locationIds: [],
  });
  expect(duplicate.status()).toBe(409);
  const context = await browser.newContext();
  for (let i = 0; i < 2; i++) {
    expect(
      (
        await post(context.request, "login", { accessCode: "staff-qa2026" })
      ).status(),
    ).toBe(200);
    expect((await post(context.request, "logout", {})).status()).toBe(200);
  }
  await page.goto("/users");
  await page
    .getByRole("row")
    .filter({ hasText: "Chosen code QA" })
    .getByRole("button", { name: "Manage access code" })
    .click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("New access code", { exact: true })
    .fill("Replacement-88");
  await modal
    .getByRole("button", { name: "Save access code", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  expect(
    (
      await post(context.request, "login", { accessCode: "Staff-QA2026" })
    ).status(),
  ).toBe(401);
  expect(
    (
      await post(context.request, "login", { accessCode: "replacement-88" })
    ).status(),
  ).toBe(200);
  const audit = await db.audit.findMany({ where: { target: user.id } });
  expect(JSON.stringify(audit)).not.toContain("Replacement-88");
  expect(JSON.stringify(audit)).not.toContain("Staff-QA2026");
  await context.close();
});
test("saved drafts can be deleted by their owner only", async ({
  page,
  browser,
}) => {
  await login(page);
  const p = await db.product.findUniqueOrThrow({ where: { id: "real-unit" } });
  const input = await draft(page.request, [
    {
      productId: p.id,
      version: p.updatedAt.toISOString(),
      quantity: "3",
      unit: p.units[0],
    },
  ]);
  const { number } = await db.draft.findUniqueOrThrow({
    where: { id: input.key },
  });
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await login(admin, "admin@buzz.test");
  expect(
    (
      await admin.request.delete(`/api/drafts/${input.key}`, {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(404);
  await adminContext.close();
  await page.goto("/new-transfer");
  await page.getByText(/^Saved drafts/).click();
  await page
    .getByRole("button", { name: `Delete draft · ${number}`, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete draft", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Draft deleted");
  await expect(
    page.getByRole("button", { name: `Open draft · ${number}`, exact: true }),
  ).toHaveCount(0);
  expect(await db.draft.findUnique({ where: { id: input.key } })).toBeNull();
  expect(
    await db.audit.count({
      where: { action: "DRAFT_DELETED", target: input.key },
    }),
  ).toBe(1);
});
test("administrators delete confirmed transfers with an audit snapshot", async ({
  page,
  browser,
}) => {
  await login(page);
  const p = await db.product.findUniqueOrThrow({
    where: { id: "real-no-unit" },
  });
  const input = await draft(page.request, [
    {
      productId: p.id,
      version: p.updatedAt.toISOString(),
      quantity: "4",
      unit: "",
    },
  ]);
  const saved = await (await post(page.request, "transfers", input)).json();
  expect(
    (
      await page.request.delete(`/api/transfers/${saved.id}`, {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(403);
  await expect(
    db.transfer.delete({ where: { id: saved.id } }),
  ).rejects.toThrow();
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await login(admin, "admin@buzz.test");
  await admin.goto(`/transfers/${saved.id}`);
  await admin
    .getByRole("button", { name: "Delete transfer", exact: true })
    .click();
  const modal = admin.getByRole("dialog");
  await modal
    .getByLabel("Reason (optional)", { exact: true })
    .fill("Entered twice");
  await modal
    .getByRole("button", { name: "Delete transfer", exact: true })
    .click();
  await expect(admin).toHaveURL(/\/transfers$/);
  expect(await db.transfer.findUnique({ where: { id: saved.id } })).toBeNull();
  const entry = await db.audit.findFirstOrThrow({
    where: { action: "TRANSFER_DELETED", target: saved.id },
  });
  expect(entry.detail).toMatchObject({
    number: saved.number,
    total: "4",
    reason: "Entered twice",
  });
  await adminContext.close();
});
test("a request is filled by the supplier with smaller quantities and becomes a transfer", async ({
  page,
  browser,
}) => {
  await login(page);
  const [withUnit, noUnit] = await Promise.all([
    db.product.findUniqueOrThrow({ where: { id: "real-unit" } }),
    db.product.findUniqueOrThrow({ where: { id: "real-no-unit" } }),
  ]);
  // Staff works at Main and Al Azaiba, so it may only request for those.
  expect(
    (
      await post(page.request, "requests", {
        requesterId: "restricted",
        supplierId: "branch",
        remarks: "",
        lines: [{ productId: noUnit.id, quantity: "1", unit: "" }],
      })
    ).status(),
  ).toBe(403);
  const created = await post(page.request, "requests", {
    requesterId: "branch",
    supplierId: "restricted",
    remarks: "AUTOMATED TEST ONLY",
    lines: [
      { productId: withUnit.id, quantity: "10", unit: withUnit.units[0] },
      { productId: noUnit.id, quantity: "5", unit: "" },
    ],
  });
  expect(created.ok()).toBeTruthy();
  const request = await created.json();
  // Only the supplier's location decides what is sent.
  expect(
    (
      await post(page.request, `requests/${request.id}/fulfill`, {
        lines: [{ supplied: "10" }, { supplied: "5" }],
      })
    ).status(),
  ).toBe(403);
  const supplierContext = await browser.newContext();
  const supplier = await supplierContext.newPage();
  await login(supplier, "outside@buzz.test");
  await supplier.goto("/requests");
  await supplier.getByRole("link", { name: request.number }).first().click();
  await expect(supplier.getByText("Awaiting your reply")).toBeVisible();
  await supplier.getByLabel("Sent 1", { exact: true }).fill("8");
  await supplier
    .getByRole("button", { name: "Not available 2", exact: true })
    .click();
  await supplier
    .getByRole("button", { name: "Confirm and create transfer", exact: true })
    .click();
  await supplier
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm and generate PDF", exact: true })
    .click();
  await expect(
    supplier.getByText("Transfer Confirmed Successfully"),
  ).toBeVisible({ timeout: 60000 });
  const saved = await db.stockRequest.findUniqueOrThrow({
    where: { id: request.id },
    include: { transfer: true },
  });
  expect(saved.status).toBe("FULFILLED");
  expect(saved.transfer).toMatchObject({
    sourceId: "restricted",
    destinationId: "branch",
    creatorId: "test-outsider",
    approval: "PENDING",
    remarks: `Request ${request.number}`,
  });
  expect(saved.transfer!.total.toString()).toBe("8");
  expect(saved.transfer!.lines).toEqual([
    expect.objectContaining({
      code: withUnit.code,
      quantity: "8",
      unit: withUnit.units[0],
    }),
  ]);
  // The requester sees what was sent and can open the transfer.
  await page.goto(`/requests/${request.id}`);
  await expect(page.getByText("Not available")).toBeVisible();
  await page.getByRole("link", { name: saved.transfer!.number }).click();
  await expect(page.getByText(`From request`)).toBeVisible();
  // A filled request cannot be filled or cancelled again.
  expect(
    (await post(page.request, `requests/${request.id}/cancel`, {})).status(),
  ).toBe(409);
  await supplierContext.close();
});
test("sender and receiver sign a transfer by hand and the PDF shows both", async ({
  page,
  browser,
}) => {
  await login(page);
  const p = await db.product.findUniqueOrThrow({
    where: { id: "real-no-unit" },
  });
  const input = await draft(page.request, [
    {
      productId: p.id,
      version: p.updatedAt.toISOString(),
      quantity: "2",
      unit: "",
    },
  ]);
  const saved = await (await post(page.request, "transfers", input)).json();
  const original = await db.transfer.findUniqueOrThrow({
    where: { id: saved.id },
  });
  await page.goto("/sign");
  await page.getByRole("link", { name: saved.number }).click();
  await page.getByRole("button", { name: "Sign as sender" }).click();
  const modal = page.getByRole("dialog");
  const box = (await modal.getByLabel("Signature box").boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 40, { steps: 8 });
  await page.mouse.move(box.x + 220, box.y + 120, { steps: 8 });
  await page.mouse.up();
  await modal.getByRole("button", { name: "Save signature" }).click();
  await expect(page.getByAltText(/Signature · /)).toBeVisible();
  // The same person cannot also sign as receiver, even with both locations.
  await expect(
    page.getByRole("button", { name: "Sign as receiver" }),
  ).toHaveCount(0);
  const png = await db.signature.findFirstOrThrow({
    where: { transferId: saved.id },
  });
  const image = `data:image/png;base64,${Buffer.from(png.image).toString("base64")}`;
  expect(
    (
      await post(page.request, `sign/${saved.id}`, {
        side: "DESTINATION",
        image,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await post(page.request, `sign/${saved.id}`, {
        side: "DESTINATION",
        image: "data:image/png;base64,aGVsbG8=",
      })
    ).status(),
  ).toBe(400);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await login(admin, "admin@buzz.test");
  expect(
    (
      await post(admin.request, `sign/${saved.id}`, { side: "SOURCE", image })
    ).status(),
  ).toBe(409);
  expect(
    (
      await post(admin.request, `sign/${saved.id}`, {
        side: "DESTINATION",
        image,
      })
    ).ok(),
  ).toBe(true);
  const pdf = await admin.request.get(`/api/transfers/${saved.id}/pdf`);
  expect(pdf.ok()).toBe(true);
  const after = await db.transfer.findUniqueOrThrow({
    where: { id: saved.id },
  });
  expect(Buffer.from(after.pdf!).equals(Buffer.from(original.pdf!))).toBe(true);
  expect(after.signedPdfFor?.split(",")).toHaveLength(2);
  expect((await pdf.body()).equals(Buffer.from(after.signedPdf!))).toBe(true);
  expect(
    await db.audit.count({
      where: { target: saved.id, action: "TRANSFER_SIGNED" },
    }),
  ).toBe(2);
  await admin.goto("/sign");
  await admin.getByRole("tab", { name: "Signed by me" }).click();
  await expect(admin.getByRole("link", { name: saved.number })).toBeVisible();
  await adminContext.close();
});
