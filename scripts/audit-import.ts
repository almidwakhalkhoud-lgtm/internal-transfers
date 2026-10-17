import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
const db = new PrismaClient();
const conflicts = await db.catalogConflict.findMany({
  where: { resolved: false },
  select: { code: true },
});
const codes = [...new Set(conflicts.map((c) => c.code))];
const affected = await db.product.findMany({
  where: { code: { in: codes }, NOT: { units: { isEmpty: true } } },
});
console.log(
  JSON.stringify(
    {
      unresolvedConflictProducts: codes.length,
      productsWithUnitsAndConflicts: affected.map((p) => ({
        code: p.code,
        units: p.units,
        source: p.source,
      })),
    },
    null,
    2,
  ),
);
const products = await db.product.count();
const units = await db.product.count({
  where: { NOT: { units: { isEmpty: true } } },
});
writeFileSync(
  "data/catalog-validation.json",
  JSON.stringify(
    {
      products,
      productsWithVerifiedUnits: units,
      unresolvedReviewEntries: conflicts.length,
      unresolvedConflictProducts: codes.length,
      barcodes: await db.barcode.count(),
    },
    null,
    2,
  ),
);
await db.$disconnect();
