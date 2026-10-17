import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

// Read-only diagnostic for QBM's own "Export to Formatted JSON".
// Unit field names are reported from the source, never guessed or inferred
// from descriptions. This command never connects to either application's DB.
const input = process.argv[2];
if (!input) throw new Error("Usage: npm run qbm:inspect -- <QBM JSON export>");
const bytes = readFileSync(resolve(input));
if (bytes.length > 25 * 1024 * 1024)
  throw new Error("QBM export exceeds 25 MB");
const root = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
if (
  root.schemaVersion !== 1 ||
  root.documentType !== "itemList" ||
  !Array.isArray(root.items)
)
  throw new Error("Expected the QBM schemaVersion 1 itemList export");
const names = new Map<string, number>();
const unitPaths = new Set<string>();
const financial = /price|cost|amount|tax/i;
function safe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safe);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !financial.test(key))
        .map(([key, entry]) => [key, safe(entry)]),
    );
  return value;
}
function evidence(
  value: unknown,
  path = "",
): { path: string; value: unknown }[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, entry]) => {
    if (financial.test(key)) return [];
    const next = path ? `${path}.${key}` : key;
    if (/uom|unit/i.test(key)) {
      unitPaths.add(next);
      return [{ path: next, value: safe(entry) }];
    }
    return evidence(entry, next);
  });
}
const items = root.items.map((item: Record<string, unknown>, index: number) => {
  if (!item || typeof item.itemName !== "string" || !item.itemName.trim())
    throw new Error(
      `Item ${index + 1}: missing string itemName; numeric identifiers must not lose leading zeros`,
    );
  const code = item.itemName.trim();
  names.set(code, (names.get(code) ?? 0) + 1);
  return {
    code,
    productGuid: typeof item.productGuid === "string" ? item.productGuid : null,
    unitEvidence: evidence(item),
  };
});
const duplicates = [...names]
  .filter(([, count]) => count > 1)
  .map(([code, count]) => ({ code, count }));
const report = {
  source: "QBM / Export to Formatted JSON",
  sourceSha256: createHash("sha256").update(bytes).digest("hex"),
  records: items.length,
  uniqueItemNames: names.size,
  duplicates,
  observedUnitPaths: [...unitPaths].sort(),
  recordsWithoutUnitFields: items.filter(
    (item: { unitEvidence: unknown[] }) => !item.unitEvidence.length,
  ).length,
  items,
};
mkdirSync("output/qbm", { recursive: true });
writeFileSync(
  "output/qbm/qbm-source-audit.json",
  JSON.stringify(report, null, 2),
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    records: items.length,
    duplicateCodes: duplicates.length,
    observedUnitPaths: report.observedUnitPaths,
    report: "output/qbm/qbm-source-audit.json",
    databaseChanges: 0,
  }),
);
