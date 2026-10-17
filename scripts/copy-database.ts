// Copies the local application database into an empty hosted database.
// Usage: TARGET_DATABASE_URL=postgresql://... npm run db:copy
// The target must already have the migrations applied (npm run db:deploy
// with DATABASE_URL pointing at it, or a first Vercel build).
import { PrismaClient } from "@prisma/client";

const targetUrl = process.env.TARGET_DATABASE_URL;
if (!targetUrl)
  throw new Error("Set TARGET_DATABASE_URL to the hosted database");
if (targetUrl === process.env.DATABASE_URL)
  throw new Error("Source and target databases are the same");

const source = new PrismaClient();
const target = new PrismaClient({ datasourceUrl: targetUrl });

async function batches<T>(
  name: string,
  read: (skip: number, take: number) => Promise<T[]>,
  write: (rows: T[]) => Promise<unknown>,
  take = 500,
) {
  let copied = 0;
  for (;;) {
    const rows = await read(copied, take);
    if (!rows.length) break;
    await write(rows);
    copied += rows.length;
  }
  console.log(`${name}: ${copied}`);
}

try {
  const [users, products, transfers] = await Promise.all([
    target.user.count(),
    target.product.count(),
    target.transfer.count(),
  ]);
  if (users || products || transfers)
    throw new Error("The target database is not empty; nothing was copied");

  await batches(
    "Locations",
    (skip, take) =>
      source.location.findMany({ skip, take, orderBy: { id: "asc" } }),
    (data) => target.location.createMany({ data }),
  );
  await batches(
    "Users",
    (skip, take) =>
      source.user.findMany({ skip, take, orderBy: { id: "asc" } }),
    (data) => target.user.createMany({ data }),
  );
  const links = await source.$queryRaw<{ A: string; B: string }[]>`
    SELECT "A", "B" FROM "_LocationToUser"`;
  for (const link of links)
    await target.$executeRaw`
      INSERT INTO "_LocationToUser" ("A", "B") VALUES (${link.A}, ${link.B})`;
  console.log(`User locations: ${links.length}`);
  await batches(
    "Products",
    (skip, take) =>
      source.product.findMany({ skip, take, orderBy: { id: "asc" } }),
    (data) => target.product.createMany({ data }),
  );
  await batches(
    "Barcodes",
    (skip, take) =>
      source.barcode.findMany({ skip, take, orderBy: { value: "asc" } }),
    (data) => target.barcode.createMany({ data }),
  );
  await batches(
    "Catalog conflicts",
    (skip, take) =>
      source.catalogConflict.findMany({ skip, take, orderBy: { id: "asc" } }),
    (data) =>
      target.catalogConflict.createMany({
        data: data.map((c) => ({
          ...c,
          existing: c.existing ?? {},
          proposed: c.proposed ?? {},
        })),
      }),
  );
  await batches(
    "Sequences",
    (skip, take) => source.sequence.findMany({ skip, take }),
    (data) => target.sequence.createMany({ data }),
  );
  await batches(
    "Transfers",
    (skip, take) =>
      source.transfer.findMany({ skip, take, orderBy: { id: "asc" } }),
    (data) =>
      target.transfer.createMany({
        data: data.map((t) => ({ ...t, lines: t.lines ?? [] })),
      }),
    50,
  );
  await batches(
    "Drafts",
    (skip, take) =>
      source.draft.findMany({ skip, take, orderBy: { id: "asc" } }),
    (data) =>
      target.draft.createMany({
        data: data.map((d) => ({ ...d, data: d.data ?? {} })),
      }),
  );
  await batches(
    "Audit entries",
    (skip, take) =>
      source.audit.findMany({ skip, take, orderBy: { id: "asc" } }),
    (data) =>
      target.audit.createMany({
        data: data.map((a) => ({ ...a, detail: a.detail ?? {} })),
      }),
  );
  console.log(
    "Done. Sessions were not copied, so everyone signs in again on the hosted site.",
  );
} finally {
  await Promise.all([source.$disconnect(), target.$disconnect()]);
}
