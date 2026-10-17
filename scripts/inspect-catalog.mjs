import XLSX from "xlsx";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const b = readFileSync("ITEMS.xls");
const w = XLSX.read(b, { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]], {
  raw: false,
  defval: "",
});
const catalog = rows.map((r) => ({
  code: String(r.Name).trim(),
  description: String(r.Description).trim(),
  barcodes: [],
  units: [],
}));
const seen = new Map();
const duplicates = [];
for (const r of catalog) {
  if (seen.has(r.code))
    duplicates.push({
      code: r.code,
      first: seen.get(r.code),
      second: r.description,
    });
  else seen.set(r.code, r.description);
}
mkdirSync("data/sources", { recursive: true });
writeFileSync("data/sources/items-catalog.json", JSON.stringify(catalog));
console.log(
  JSON.stringify(
    {
      rows: catalog.length,
      empty: catalog.filter((r) => !r.code || !r.description).length,
      duplicates,
      sha256: createHash("sha256").update(b).digest("hex"),
    },
    null,
    2,
  ),
);
