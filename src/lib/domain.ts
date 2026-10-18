import { z } from "zod";
export const identifier = (value: string) => value.trim();
export const quantity = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,3})?$/)
  .refine((v) => Number(v) > 0, "Quantity must be positive");
export const transferInput = z
  .object({
    key: z.uuid(),
    sourceId: z.string().min(1),
    destinationId: z.string().min(1),
    date: z.iso.date(),
    remarks: z.string().max(2000),
    lines: z
      .array(
        z.object({
          productId: z.string().min(1),
          version: z.iso.datetime(),
          quantity,
          unit: z.string().max(100),
          note: z.string().trim().max(500).optional(),
          description: z.string().trim().min(1).max(2000).optional(),
          duplicateAccepted: z.boolean().optional(),
        }),
      )
      .min(1)
      .max(500),
  })
  .refine(
    (v) => v.sourceId !== v.destinationId,
    "Source and destination must differ",
  );
export type SnapshotLine = {
  code: string;
  description: string;
  barcodes: string[];
  quantity: string;
  unit: string;
  note?: string;
};
export function totalQuantity(lines: { quantity: string }[]) {
  return lines.reduce(
    (sum, line) =>
      sum +
      BigInt(
        line.quantity.replace(".", "") +
          "0".repeat(3 - (line.quantity.split(".")[1]?.length ?? 0)),
      ),
    0n,
  );
}
export function formatTotal(total: bigint) {
  return `${total / 1000n}.${String(total % 1000n).padStart(3, "0")}`;
}
// One counter numbers every transfer; the letters name the route, e.g.
// Main → Al Azaiba is MA-0001 and the next one, Main → Sur, is MS-0002.
// Until both locations are chosen a draft's number is the bare counter.
export function numberFor(value: number, prefix = "") {
  const digits = String(value).padStart(4, "0");
  return prefix ? `${prefix}-${digits}` : digits;
}
export function routeCode(source: string, destination: string) {
  const first = (name: string) => name.trim().charAt(0).toUpperCase();
  return first(source) + first(destination);
}
export const sequenceOf = (number: string) =>
  Number(number.match(/(\d+)$/)?.[1] ?? 0);
export function allowedTransition(from: string, to: string) {
  return (
    (from === "PENDING" && ["APPROVED", "REJECTED"].includes(to)) ||
    (from === "APPROVED" && to === "RECEIVED")
  );
}
export function canAccess(
  user: { id: string; role: string; locations: { id: string }[] },
  t: { creatorId: string; sourceId: string; destinationId: string },
) {
  return (
    user.role === "ADMIN" ||
    t.creatorId === user.id ||
    user.locations.some((l) => l.id === t.sourceId || l.id === t.destinationId)
  );
}
// "ss" (midwakh service) stands for whatever service was done, so staff name
// it on each transfer line. Every other product keeps its catalog name.
export const renamable = (code: string) => code.trim().toLowerCase() === "ss";
export const outerUnits = ["CTN", "BOX", "DOZEN", "SET", "PKTS"] as const;
// QBM names carry the pack size: "(1x20)" is an outer unit of 20 pieces and
// "(1x30x25)" a carton of 30 boxes of 25. A name without one has no units.
export function unitsFromDescription(description: string, outer = "CTN") {
  const pack = [
    ...description.matchAll(
      /\(\s*1\s*[x×*]\s*(\d+)(?:\s*[x×*]\s*(\d+))?\s*\)/gi,
    ),
  ].at(-1);
  if (!pack) return [];
  return pack[2]
    ? [`CTN(1x${pack[1]})`, `BOX(1x${pack[2]})`, "PCS"]
    : [`${outer}(1x${pack[1]})`, "PCS"];
}
export type CatalogRow = {
  code: string;
  description: string;
  barcodes: string[];
  units: string[];
};
export function validateCatalog(rows: CatalogRow[]) {
  const seen = new Set<string>();
  const barcodes = new Map<string, string>();
  const errors: string[] = [];
  rows.forEach((r, i) => {
    if (!r.code || !r.description)
      errors.push(`Row ${i + 1}: code and description required`);
    if (seen.has(r.code)) errors.push(`Row ${i + 1}: duplicate code ${r.code}`);
    seen.add(r.code);
    for (const b of r.barcodes) {
      if (barcodes.has(b) && barcodes.get(b) !== r.code)
        errors.push(`Row ${i + 1}: ambiguous barcode ${b}`);
      barcodes.set(b, r.code);
    }
  });
  for (const r of rows)
    for (const b of r.barcodes)
      if (seen.has(b) && b !== r.code)
        errors.push(`Barcode ${b} conflicts with another item code`);
  return errors;
}
