import XLSX from "xlsx";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { CatalogRow } from "../src/lib/domain";
const prisma = new PrismaClient();
const hash = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
const read = (file: string) => {
  const w = XLSX.read(readFileSync(file), { type: "buffer" });
  return XLSX.utils.sheet_to_json<Record<string, string>>(
    w.Sheets[w.SheetNames[0]],
    { raw: false, defval: "" },
  );
};
const primary = read("ITEMS.xls");
const report = {
  date: "2026-10-17",
  primarySha256: hash("ITEMS.xls"),
  primaryRows: primary.length,
  primaryImported: 0,
  websiteAdded: 0,
  enriched: 0,
  conflicts: 0,
  skipped: [] as { code: string; reason: string }[],
  stores: [] as { store: string; rows: number; sha256: string }[],
  missingBarcodeRows: 0,
};
await prisma.$transaction(
  async (db) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(8001)`;
    if (await db.product.count())
      throw new Error(
        "Initial import requires an empty catalog. Use the administrator import UI for updates.",
      );
    const primaryCodes = new Set<string>();
    for (const row of primary) {
      const code = String(row.Name).trim(),
        description = String(row.Description).trim();
      if (!code || !description || primaryCodes.has(code)) {
        report.skipped.push({
          code,
          reason: !description ? "Missing description" : "Duplicate code",
        });
        continue;
      }
      primaryCodes.add(code);
      await db.product.create({
        data: { code, description, units: [], source: "ITEMS.xls" },
      });
      report.primaryImported++;
    }
    const crossStoreConflicts = new Set<string>();
    const secondary = new Map<
      string,
      { row: CatalogRow; stores: Set<string> }
    >();
    for (const [store, file] of [
      ["Order / All Stores", "all-stores.xlsx"],
      ["HyperMarket", "hypermarket-all.xlsx"],
      ["VAN SALES STORE", "van-sales-store.xlsx"],
      ["SMOKING", "smoking.xlsx"],
    ]) {
      const path = `data/sources/${file}`;
      if (!existsSync(path))
        throw new Error(`Missing authorized export ${store}`);
      const rows = read(path);
      report.stores.push({ store, rows: rows.length, sha256: hash(path) });
      for (const r of rows) {
        const code = r.Code.trim();
        if (!code || code.startsWith("parent-")) {
          report.skipped.push({
            code,
            reason: "Website grouping record; not an individual SKU",
          });
          continue;
        }
        const row: CatalogRow = {
          code,
          description: r.Name.trim(),
          units: [
            ...new Set(
              r.Units.split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            ),
          ],
          barcodes: r.Barcode ? [r.Barcode.trim()] : [],
        };
        if (!row.description) {
          report.skipped.push({
            code,
            reason: "Website variant has no stand-alone product name",
          });
          continue;
        }
        const previous = secondary.get(code);
        if (previous) {
          previous.stores.add(store);
          if (JSON.stringify(previous.row) !== JSON.stringify(row)) {
            crossStoreConflicts.add(code);
            await db.catalogConflict.create({
              data: {
                code,
                existing: previous.row,
                proposed: row,
                source: `mehdiali.om / ${store}`,
              },
            });
            report.conflicts++;
          }
          continue;
        }
        secondary.set(code, { row, stores: new Set([store]) });
      }
    }
    for (const { row, stores } of secondary.values()) {
      if (!row.barcodes.length) report.missingBarcodeRows++;
      const p = await db.product.findUnique({ where: { code: row.code } });
      const source = `mehdiali.om / ${[...stores].join(", ")}`;
      if (!p) {
        await db.product.create({
          data: {
            code: row.code,
            description: row.description,
            units: crossStoreConflicts.has(row.code) ? [] : row.units,
            source,
            barcodes: { create: row.barcodes.map((value) => ({ value })) },
          },
        });
        report.websiteAdded++;
        continue;
      }
      if (
        p.description === row.description &&
        !crossStoreConflicts.has(row.code)
      ) {
        await db.product.update({
          where: { id: p.id },
          data: {
            units: row.units,
            source: `ITEMS.xls + ${source}`,
            barcodes: { create: row.barcodes.map((value) => ({ value })) },
          },
        });
        report.enriched++;
      } else {
        await db.catalogConflict.create({
          data: {
            code: row.code,
            existing: {
              code: p.code,
              description: p.description,
              units: p.units,
              barcodes: [],
            },
            proposed: row,
            source,
          },
        });
        report.conflicts++;
      }
    }
    // These two location names are explicitly printed on the supplied reference document.
    for (const name of ["Main", "Al Azaiba"])
      await db.location.upsert({
        where: { name },
        create: { name },
        update: {},
      });
    await db.audit.create({
      data: {
        actor: "system:initial-source-import",
        action: "SOURCES_RECONCILED",
        target: "ITEMS.xls + mehdiali.om",
        detail: JSON.parse(JSON.stringify(report)),
      },
    });
  },
  { timeout: 120000 },
);
mkdirSync("data", { recursive: true });
writeFileSync(
  "data/reconciliation-report.json",
  JSON.stringify(report, null, 2),
);
if (hash("ITEMS.xls") !== report.primarySha256)
  throw new Error("Original workbook changed");
console.log(JSON.stringify(report, null, 2));
await prisma.$disconnect();
