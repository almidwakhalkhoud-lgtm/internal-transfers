import { Prisma } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./auth";
import {
  transferInput,
  totalQuantity,
  formatTotal,
  canAccess,
  type SnapshotLine,
} from "./domain";
import { generatePdf } from "./pdf";
import { hash } from "./auth";
type User = NonNullable<
  Awaited<ReturnType<typeof import("./auth").currentUser>>
>;
export async function confirmTransfer(user: User, input: unknown) {
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
    return await db.$transaction(
      async (tx) => {
        const draft = await tx.draft.findUnique({ where: { id: data.key } });
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
          if (seen.has(p.id) && !line.duplicateAccepted)
            throw new HttpError(400, `Review duplicate product ${p.code}`);
          seen.add(p.id);
          return {
            code: p.code,
            description: p.description,
            barcodes: p.barcodes.map((b) => b.value),
            quantity: line.quantity,
            unit: line.unit,
            ...(line.note ? { note: line.note } : {}),
          };
        });
        const transfer = await tx.transfer.create({
          data: {
            key: data.key,
            number: draft.number,
            creatorId: user.id,
            creatorName: user.name,
            sourceId: data.sourceId,
            destinationId: data.destinationId,
            source: locations.find((l) => l.id === data.sourceId)!.name,
            destination: locations.find((l) => l.id === data.destinationId)!
              .name,
            date: new Date(data.date),
            remarks: data.remarks,
            lines,
            total: formatTotal(totalQuantity(lines)),
          },
        });
        await tx.audit.create({
          data: {
            actor: user.id,
            action: "TRANSFER_CONFIRMED",
            target: transfer.id,
            detail: { number: transfer.number, lines: lines.length },
          },
        });
        await tx.draft.delete({ where: { id: data.key } });
        return transfer;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(e.code)
    ) {
      const saved = await db.transfer.findUnique({ where: { key: data.key } });
      if (saved && saved.creatorId === user.id) return saved;
      throw new HttpError(
        409,
        "The catalog or draft changed. Please review and retry.",
      );
    }
    throw e;
  }
}
const generating = new Map<string, Promise<Buffer>>();
export async function transferPdf(user: User, id: string) {
  const t = await db.transfer.findUnique({
    where: { id },
  });
  if (!t) throw new HttpError(404, "Transfer not found");
  if (!canAccess(user, t)) throw new HttpError(403, "Transfer access denied");
  if (t.pdf) return { t, buffer: Buffer.from(t.pdf) };
  let job = generating.get(id);
  if (!job) {
    job = (async () => {
      try {
        const buffer = await generatePdf({
          ...t,
          date: t.date.toISOString(),
          lines: t.lines as SnapshotLine[],
          total: t.total.toString(),
          employee: t.creatorName,
        });
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
        await db.transfer.update({ where: { id }, data: { pdfError: true } });
        throw e;
      } finally {
        generating.delete(id);
      }
    })();
    generating.set(id, job);
  }
  return { t, buffer: await job };
}
