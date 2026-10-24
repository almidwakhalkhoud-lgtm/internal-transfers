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
// A request names the products and quantities a location asks another for.
export const requestInput = z
  .object({
    requesterId: z.string().min(1),
    supplierId: z.string().min(1),
    remarks: z.string().max(2000),
    // The saved draft this request was written in, removed once it is sent.
    draftId: z.uuid().optional(),
    lines: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity,
          unit: z.string().max(100),
          note: z.string().trim().max(500).optional(),
          description: z.string().trim().min(1).max(2000).optional(),
        }),
      )
      .min(1)
      .max(500),
  })
  .refine(
    (v) => v.requesterId !== v.supplierId,
    "Source and destination must differ",
  );
// What the supplier decides per line, in the request's line order: the
// quantity it sends, or that it does not have the item.
export const supplyInput = z.object({
  lines: z
    .array(
      z.union([
        z.object({
          supplied: quantity,
          // The unit the supplier sends in, when it differs from the one asked.
          unit: z.string().max(100).optional(),
          removed: z.literal(false).optional(),
        }),
        z.object({ removed: z.literal(true) }),
      ]),
    )
    .max(500),
  // Items the supplier adds that were not asked for.
  added: z
    .array(
      z.object({
        productId: z.string().min(1),
        supplied: quantity,
        unit: z.string().max(100),
        description: z.string().trim().min(1).max(2000).optional(),
      }),
    )
    .max(500)
    .default([]),
  remarks: z.string().max(2000).optional(),
});
export type RequestLine = {
  productId: string;
  code: string;
  description: string;
  quantity: string;
  unit: string;
  note?: string;
  supplied?: string;
  removed?: boolean;
  // The supplier sends this line in another of the product's units.
  supplyUnit?: string;
  // The supplier added this line; nothing of it was asked for.
  added?: boolean;
};
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
// A request is seen only by the person who made it, the people working at
// the location it asks, and administrators. Only that location fills it.
export function canSeeRequest(
  user: { id: string; role: string; locations: { id: string }[] },
  r: { creatorId: string; supplierId: string },
) {
  return r.creatorId === user.id || canSupply(user, r);
}
export function canSupply(
  user: { role: string; locations: { id: string }[] },
  r: { supplierId: string },
) {
  return (
    user.role === "ADMIN" || user.locations.some((l) => l.id === r.supplierId)
  );
}
// A user sees transfers they made, those of the locations they work at, and
// those of locations an administrator let them view.
export function canAccess(
  user: {
    id: string;
    role: string;
    locations: { id: string }[];
    viewLocations?: { id: string }[];
  },
  t: { creatorId: string; sourceId: string; destinationId: string },
) {
  return (
    user.role === "ADMIN" ||
    t.creatorId === user.id ||
    [...user.locations, ...(user.viewLocations ?? [])].some(
      (l) => l.id === t.sourceId || l.id === t.destinationId,
    )
  );
}
// The sender signs for the source location and the receiver for the
// destination; administrators may sign for either. Rejected transfers are
// not signed, and one person signs only one side of a transfer unless an
// administrator made an exception for them. Viewing a location never lets
// anyone sign for it.
export const signatureSides = ["SOURCE", "DESTINATION"] as const;
export type SignatureSide = (typeof signatureSides)[number];
export function signableSides(
  user: {
    id: string;
    role: string;
    locations: { id: string }[];
    signBothSides?: boolean;
  },
  t: {
    sourceId: string;
    destinationId: string;
    approval: string;
    signatures: { side: string; userId: string }[];
  },
): SignatureSide[] {
  if (t.approval === "REJECTED") return [];
  if (!user.signBothSides && t.signatures.some((s) => s.userId === user.id))
    return [];
  const mine = (id: string) =>
    user.role === "ADMIN" || user.locations.some((l) => l.id === id);
  return signatureSides.filter(
    (side) =>
      !t.signatures.some((s) => s.side === side) &&
      mine(side === "SOURCE" ? t.sourceId : t.destinationId),
  );
}
// A drawn signature arrives as a PNG data URL; anything else is refused.
export function signaturePng(dataUrl: string) {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) return null;
  const bytes = Buffer.from(dataUrl.slice(prefix.length), "base64");
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length > 300_000 || magic.some((b, i) => bytes[i] !== b))
    return null;
  return bytes;
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
// Sorts a spreadsheet into rows to import and rows to skip, so one bad row
// (no code, no description, a code already used higher up, or a barcode
// another product has) no longer blocks the rest. `row` is the sheet's row
// number, as people see it in Excel.
export type SkippedRow = {
  row: number;
  code: string;
  reason: "no-code" | "no-description" | "duplicate" | "barcode";
  firstRow?: number;
};
export function splitCatalog(rows: (CatalogRow & { row: number })[]) {
  const valid: CatalogRow[] = [];
  const skipped: SkippedRow[] = [];
  const codes = new Map<string, number>();
  const barcodes = new Map<string, string>();
  for (const { row, ...r } of rows) {
    const skip = (reason: SkippedRow["reason"], firstRow?: number) =>
      skipped.push({ row, code: r.code, reason, firstRow });
    if (!r.code) skip("no-code");
    else if (!r.description) skip("no-description");
    else if (codes.has(r.code)) skip("duplicate", codes.get(r.code));
    else if (
      r.barcodes.some(
        (b) =>
          (barcodes.has(b) && barcodes.get(b) !== r.code) ||
          (codes.has(b) && b !== r.code),
      )
    )
      skip("barcode");
    else {
      codes.set(r.code, row);
      for (const b of r.barcodes) barcodes.set(b, r.code);
      valid.push(r);
    }
  }
  // A code that equals another kept row's barcode is skipped as well.
  const used = new Set(valid.flatMap((r) => r.barcodes));
  return {
    valid: valid.filter((r) => {
      const clash = used.has(r.code) && !r.barcodes.includes(r.code);
      if (clash)
        skipped.push({
          row: codes.get(r.code)!,
          code: r.code,
          reason: "barcode",
        });
      return !clash;
    }),
    skipped: skipped.sort((a, b) => a.row - b.row),
  };
}
// Which pending catalog conflicts need no review: the same proposal waiting
// more than once (the newest is kept), or a proposal that matches the product
// as it is now. Empty units or barcodes in a proposal mean the file did not
// supply that column, so they are not a difference. Anything else stays.
export function unneededConflicts(
  conflicts: { id: string; code: string; proposed: unknown; createdAt: Date }[],
  products: {
    code: string;
    description: string;
    units: string[];
    barcodes: string[];
  }[],
) {
  const set = (values: string[]) => JSON.stringify([...values].sort());
  const byCode = new Map(products.map((p) => [p.code, p]));
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const unchanged: string[] = [];
  const newest = [...conflicts].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  for (const c of newest) {
    const p = c.proposed as Partial<CatalogRow>;
    const key = JSON.stringify([
      c.code,
      p.description ?? "",
      [...(p.units ?? [])].sort(),
      [...(p.barcodes ?? [])].sort(),
    ]);
    if (seen.has(key)) {
      duplicates.push(c.id);
      continue;
    }
    seen.add(key);
    const current = byCode.get(c.code);
    if (
      current &&
      (p.code ?? c.code) === current.code &&
      (p.description ?? "") === current.description &&
      (!p.units?.length || set(p.units) === set(current.units)) &&
      (!p.barcodes?.length || set(p.barcodes) === set(current.barcodes))
    )
      unchanged.push(c.id);
  }
  return { duplicates, unchanged };
}
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
