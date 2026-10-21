import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
const db = new PrismaClient();
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "54339" ||
    url.pathname !== "/buzz_notifications_test"
  )
    throw new Error(
      "Notification fixtures require the isolated notification test cluster",
    );
  await db.$executeRawUnsafe(
    'TRUNCATE "TransferNotification", "PushSubscription", "PushDelivery", "NotificationWorker", "Session", "LoginAttempt", "Transfer", "Draft", "Audit", "CatalogConflict", "Barcode", "Product", "_LocationToUser", "Location", "User", "Sequence", "ApiKey", "StockRequest", "Signature", "QbmEntry" CASCADE',
  );
  await db.location.createMany({
    data: [
      { id: "notify-source", name: "Central warehouse" },
      { id: "notify-shop", name: "مغازه مقصد" },
      { id: "notify-other", name: "Other shop" },
    ],
  });
  for (const [id, name, role, locations, token] of [
    [
      "notify-creator",
      "Sending employee",
      "STAFF",
      ["notify-source", "notify-shop"],
      process.env.BUZZ_TEST_CREATOR_SESSION,
    ],
    [
      "notify-recipient",
      "مدیر مغازه",
      "STAFF",
      ["notify-shop"],
      process.env.BUZZ_TEST_RECIPIENT_SESSION,
    ],
    [
      "notify-other-user",
      "Other recipient",
      "STAFF",
      ["notify-other"],
      process.env.BUZZ_TEST_OTHER_SESSION,
    ],
    [
      "notify-admin",
      "Administrator",
      "ADMIN",
      [],
      process.env.BUZZ_TEST_ADMIN_SESSION,
    ],
  ] as const) {
    await db.user.create({
      data: {
        id,
        name,
        email: `${id}@example.test`,
        password: "unused-test-password",
        role,
        locale: id === "notify-recipient" ? "fa" : "en",
        menus: id === "notify-creator" ? ["new-transfer", "transfers"] : [],
        locations: { connect: locations.map((id) => ({ id })) },
      },
    });
    await db.session.create({
      data: {
        id: createHash("sha256").update(token!).digest("hex"),
        userId: id,
        expires: new Date(Date.now() + 3600_000),
      },
    });
  }
  await db.product.create({
    data: {
      id: "notify-product",
      code: "000123",
      description: "محصول آزمایش اعلان",
      units: ["کارتن"],
      source: "notification test fixture",
      barcodes: { create: [{ value: "0012300119139" }] },
    },
  });
}
main().finally(() => db.$disconnect());
