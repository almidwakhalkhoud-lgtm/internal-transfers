import { Prisma } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./auth";
import {
  transferInput,
  totalQuantity,
  formatTotal,
  canAccess,
  numberFor,
  routeCode,
  renamable,
  type SnapshotLine,
} from "./domain";
import { generatePdf } from "./pdf";
import { hash } from "./auth";
type User = NonNullable<
  Awaited<ReturnType<typeof import("./auth").currentUser>>
>;
// Writes a confirmed transfer and its audit entry inside the caller's
// transaction. Both confirmation and request fulfilment end here.
export async function insertTransfer(
  tx: Prisma.TransactionClient,
  user: User,
  t: {
    key: string;
    sequence: number;
    source: { id: string; name: string };
    destination: { id: string; name: string };
    date: Date;
    remarks: string;
    lines: SnapshotLine[];
    detail?: Record<string, string>;
  },
) {
  const transfer = await tx.transfer.create({
    data: {
      key: t.key,
      number: numberFor(
        t.sequence,
        routeCode(t.source.name, t.destination.name),
      ),
      creatorId: user.id,
      creatorName: user.name,
      sourceId: t.source.id,
      destinationId: t.destination.id,
      source: t.source.name,
      destination: t.destination.name,
      date: t.date,
      confirmedAt: new Date(),
      remarks: t.remarks,
      lines: t.lines,
      total: formatTotal(totalQuantity(t.lines)),
    },
  });
  await tx.audit.create({
    data: {
      actor: user.id,
      action: "TRANSFER_CONFIRMED",
      target: transfer.id,
      detail: {
        number: transfer.number,
        from: transfer.source,
        to: transfer.destination,
        lines: t.lines.length,
        total: transfer.total.toString(),
        ...t.detail,
      },
    },
  });
  await tx.transferNotification.upsert({
    where: { transferId: transfer.id },
    create: { transferId: transfer.id, destinationId: transfer.destinationId },
    update: {},
  });
  return transfer;
}
// Two confirmations at once both take the counter; the database lets one
// through and the other is simply run again with the next number.
class CounterBusy extends Error {}
export async function confirmTransfer(user: User, input: unknown) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await confirmOnce(user, input);
    } catch (e) {
      if (!(e instanceof CounterBusy)) throw e;
      if (attempt === 5)
        throw new HttpError(
          409,
          "The catalog or draft changed. Please review and retry.",
        );
    }
  }
}
async function confirmOnce(user: User, input: unknown) {
  const parsed = transferInput.safeParse(input);
  if (!parsed.success)
    throw new HttpError(
      400,
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  const data = parsed.data;
  const existing = await db.transfer.findUnique({ where: { key: data.key } });
  if (existing) {
    if (existing.creatorId !== user.id)
      throw new HttpError(403, "Not authorized");
    return existing;
  }
  try {
    const created = await db.$transaction(
      async (tx) => {
        const draft = await tx.draft.findUnique({ where: { id: data.key } });
        if (!draft) {
          const confirmed = await tx.transfer.findUnique({
            where: { key: data.key },
          });
          if (confirmed?.creatorId === user.id) return confirmed;
        }
        if (!draft || draft.userId !== user.id)
          throw new HttpError(400, "Save the draft before confirmation");
        const locations = await tx.location.findMany({
          where: {
            id: { in: [data.sourceId, data.destinationId] },
            active: true,
          },
        });
        if (locations.length !== 2)
          throw new HttpError(400, "Choose active locations");
        if (
          user.role !== "ADMIN" &&
          !user.locations.some((l) => l.id === data.sourceId)
        )
          throw new HttpError(403, "Location access denied");
        const products = await tx.product.findMany({
          where: {
            id: { in: data.lines.map((l) => l.productId) },
            active: true,
          },
          include: { barcodes: true },
        });
        const seen = new Set<string>();
        const lines: SnapshotLine[] = data.lines.map((line) => {
          const p = products.find((p) => p.id === line.productId);
          if (!p) throw new HttpError(400, "A product is unavailable");
          if (p.updatedAt.toISOString() !== line.version)
            throw new HttpError(
              409,
              "Product data changed. Look up the product again before confirmation.",
            );
          if (line.unit !== "" && !p.units.includes(line.unit))
            throw new HttpError(400, `Invalid unit for ${p.code}`);
          if (line.description && !renamable(p.code))
            throw new HttpError(400, `The name of ${p.code} cannot be changed`);
          if (seen.has(p.id) && !line.duplicateAccepted)
            throw new HttpError(400, `Review duplicate product ${p.code}`);
          seen.add(p.id);
          return {
            code: p.code,
            description: line.description || p.description,
            barcodes: p.barcodes.map((b) => b.value),
            quantity: line.quantity,
            unit: line.unit,
            ...(line.note ? { note: line.note } : {}),
          };
        });
        // The number is taken only now, so drafts never use numbers up.
        const { value } = await tx.sequence.upsert({
          where: { id: "transfer" },
          create: { id: "transfer", value: 1 },
          update: { value: { increment: 1 } },
        });
        const transfer = await insertTransfer(tx, user, {
          key: data.key,
          sequence: value,
          source: locations.find((l) => l.id === data.sourceId)!,
          destination: locations.find((l) => l.id === data.destinationId)!,
          date: new Date(data.date),
          remarks: data.remarks,
          lines,
        });
        await tx.draft.delete({ where: { id: data.key } });
        return transfer;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return created;
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(e.code)
    ) {
      const saved = await db.transfer.findUnique({ where: { key: data.key } });
      if (saved && saved.creatorId === user.id) return saved;
      if (e.code === "P2034") throw new CounterBusy();
      throw new HttpError(
        409,
        "The catalog or draft changed. Please review and retry.",
      );
    }
    throw e;
  }
}
const generating = new Map<string, Promise<Buffer>>();
// `user` is null for an API key: it may already list and read every
// transfer, so it may read their PDFs too (the QBM program archives them).
export async function transferPdf(user: User | null, id: string) {
  const t = await db.transfer.findUnique({
    where: { id },
    include: { signatures: { orderBy: { signedAt: "asc" } } },
  });
  if (!t) throw new HttpError(404, "Transfer not found");
  if (user && !canAccess(user, t))
    throw new HttpError(403, "Transfer access denied");
  // Once signed, the PDF people download shows the signatures. It is made
  // apart from the saved PDF, which stays as it was at confirmation.
  // The leading layout version rebuilds signed PDFs when their layout changes.
  const signedFor = t.signatures.length
    ? `5:${t.signatures.map((s) => s.id).join(",")}`
    : "";
  if (signedFor && t.signedPdf && t.signedPdfFor === signedFor)
    return { t, buffer: Buffer.from(t.signedPdf) };
  if (!signedFor && t.pdf) return { t, buffer: Buffer.from(t.pdf) };
  const jobKey = `${id}:${signedFor}`;
  let job = generating.get(jobKey);
  if (!job) {
    job = (async () => {
      try {
        const buffer = await generatePdf({
          ...t,
          date: t.date.toISOString(),
          lines: t.lines as SnapshotLine[],
          total: t.total.toString(),
          signatures: t.signatures.map((s) => ({
            side: s.side,
            signerName: s.signerName,
            signedAt: s.signedAt,
            image: Buffer.from(s.image),
          })),
        });
        if (signedFor) {
          await db.transfer.update({
            where: { id },
            data: {
              signedPdf: new Uint8Array(buffer),
              signedPdfFor: signedFor,
            },
          });
          return buffer;
        }
        await db.transfer.updateMany({
          where: { id, pdf: null },
          data: {
            pdf: new Uint8Array(buffer),
            pdfHash: hash(buffer),
            pdfError: false,
          },
        });
        const saved = await db.transfer.findUniqueOrThrow({
          where: { id },
          select: { pdf: true },
        });
        return Buffer.from(saved.pdf!);
      } catch (e) {
        if (!signedFor)
          await db.transfer.update({ where: { id }, data: { pdfError: true } });
        throw e;
      } finally {
        generating.delete(jobKey);
      }
    })();
    generating.set(jobKey, job);
  }
  return { t, buffer: await job };
}
