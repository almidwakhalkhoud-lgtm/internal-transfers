import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { audit, hash, HttpError } from "./auth";
import { allowedTransition, type SnapshotLine } from "./domain";
import { transferPdf } from "./transfers";

// Read access for programs such as the QBM entry app. They send
// `Authorization: Bearer buzz_…`; there is no cookie, session or CSRF here,
// and a key can only list transfers, read their PDFs and record that one was
// typed into QBM, plus approve it afterwards when an administrator allowed that key to.
export function newApiKey() {
  const key = `buzz_${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), hash: hash(key) };
}
async function keyFrom(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const key = /^Bearer\s+(buzz_[A-Za-z0-9_-]{43})$/.exec(header.trim())?.[1];
  if (!key) throw new HttpError(401, "Missing or malformed API key");
  const found = await db.apiKey.findUnique({ where: { hash: hash(key) } });
  if (!found || found.revokedAt) throw new HttpError(401, "Invalid API key");
  // Recording every poll would be noise; a minute is precise enough.
  if (!found.lastUsedAt || Date.now() - found.lastUsedAt.getTime() > 60_000)
    await db.apiKey.update({
      where: { id: found.id },
      data: { lastUsedAt: new Date() },
    });
  return found;
}
const select = {
  id: true,
  number: true,
  date: true,
  confirmedAt: true,
  source: true,
  destination: true,
  creatorName: true,
  creator: { select: { name: true } },
  approval: true,
  total: true,
  lines: true,
  qbmEntry: { select: { reference: true, enteredAt: true } },
  // Who signed, never the signature image: the QBM program shows the count.
  signatures: {
    select: { side: true, signerName: true, signedAt: true },
    orderBy: { signedAt: "asc" },
  },
} satisfies Prisma.TransferSelect;
function shape(t: Prisma.TransferGetPayload<{ select: typeof select }>) {
  return {
    id: t.id,
    number: t.number,
    date: t.date.toISOString().slice(0, 10),
    confirmedAt: t.confirmedAt.toISOString(),
    from: t.source,
    to: t.destination,
    createdBy: t.creatorName || t.creator.name,
    approval: t.approval,
    totalQuantity: t.total.toString(),
    qbm: t.qbmEntry
      ? {
          reference: t.qbmEntry.reference,
          enteredAt: t.qbmEntry.enteredAt.toISOString(),
        }
      : null,
    signatures: t.signatures.map((s) => ({
      side: s.side,
      signerName: s.signerName,
      signedAt: s.signedAt.toISOString(),
    })),
    // Item notes stay in BUZZ; QBM only needs what is typed into its grid.
    items: (t.lines as SnapshotLine[]).map((l) => ({
      code: l.code,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
    })),
  };
}
async function transferFor(idOrNumber: string) {
  const t = await db.transfer.findFirst({
    where: { OR: [{ id: idOrNumber }, { number: idOrNumber }] },
    select,
  });
  if (!t) throw new HttpError(404, "Transfer not found");
  return t;
}
export async function integrationApi(
  req: NextRequest,
  path: string,
  method: string,
) {
  const key = await keyFrom(req);
  const parts = path.split("/").slice(1);
  if (parts[0] !== "transfers") throw new HttpError(404, "Endpoint not found");
  if (parts.length === 1 && method === "GET") {
    const q = req.nextUrl.searchParams;
    const v = z
      .object({
        entered: z.enum(["yes", "no", "all"]).default("no"),
        approval: z
          .enum(["PENDING", "APPROVED", "REJECTED", "RECEIVED"])
          .optional(),
        since: z.iso.date().optional(),
        page: z.coerce.number().int().min(0).default(0),
      })
      .parse(Object.fromEntries(q));
    const where: Prisma.TransferWhereInput = {
      ...(v.entered === "no" ? { qbmEntry: null } : {}),
      ...(v.entered === "yes" ? { qbmEntry: { isNot: null } } : {}),
      ...(v.approval ? { approval: v.approval } : {}),
      ...(v.since ? { date: { gte: new Date(v.since) } } : {}),
    };
    const size = 50;
    const [items, count] = await Promise.all([
      db.transfer.findMany({
        where,
        select,
        orderBy: { confirmedAt: "asc" },
        take: size,
        skip: v.page * size,
      }),
      db.transfer.count({ where }),
    ]);
    return NextResponse.json({
      items: items.map(shape),
      count,
      page: v.page,
      pageSize: size,
    });
  }
  if (parts.length === 2 && method === "GET")
    return NextResponse.json(shape(await transferFor(parts[1])));
  // The transfer's PDF as people download it here (signatures included), so
  // the QBM program can keep a copy beside the transfer it entered.
  if (parts.length === 3 && parts[2] === "pdf" && method === "GET") {
    const t = await transferFor(parts[1]);
    const { buffer } = await transferPdf(null, t.id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${t.number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  if (parts.length === 3 && parts[2] === "qbm") {
    const t = await transferFor(parts[1]);
    if (method === "POST") {
      const { reference } = z
        .object({ reference: z.string().trim().min(1).max(100) })
        .parse(await req.json());
      // Repeating the same call is harmless; a different reference is not.
      if (t.qbmEntry) {
        if (t.qbmEntry.reference !== reference)
          throw new HttpError(
            409,
            `Already entered in QBM as ${t.qbmEntry.reference}`,
          );
        return NextResponse.json(shape(t));
      }
      await db.qbmEntry.create({
        data: { transferId: t.id, reference, keyId: key.id },
      });
      await audit(`api:${key.name}`, "QBM_ENTERED", t.id, {
        number: t.number,
        reference,
      });
      return NextResponse.json(shape(await transferFor(t.id)));
    }
    if (method === "DELETE") {
      if (t.qbmEntry) {
        await db.qbmEntry.delete({ where: { transferId: t.id } });
        await audit(`api:${key.name}`, "QBM_ENTRY_REMOVED", t.id, {
          number: t.number,
          reference: t.qbmEntry.reference,
        });
      }
      return NextResponse.json(shape(await transferFor(t.id)));
    }
  }
  if (parts.length === 3 && parts[2] === "approve" && method === "POST") {
    if (!key.canApprove)
      throw new HttpError(403, "This API key may not approve transfers");
    const t = await transferFor(parts[1]);
    // Approval follows the QBM entry, never stands in for it.
    if (!t.qbmEntry)
      throw new HttpError(409, "Record the QBM entry before approving");
    // Repeating the call is harmless.
    if (t.approval === "APPROVED") return NextResponse.json(shape(t));
    if (!allowedTransition(t.approval, "APPROVED"))
      throw new HttpError(409, `Transfer is ${t.approval.toLowerCase()}`);
    await db.$transaction(async (tx) => {
      const result = await tx.transfer.updateMany({
        where: { id: t.id, approval: t.approval },
        data: { approval: "APPROVED" },
      });
      if (result.count !== 1)
        throw new HttpError(409, "Status changed. Refresh and retry.");
      await tx.audit.create({
        data: {
          actor: `api:${key.name}`,
          action: "APPROVED",
          target: t.id,
          detail: { from: t.approval, number: t.number, key: key.name },
        },
      });
    });
    return NextResponse.json(shape(await transferFor(t.id)));
  }
  throw new HttpError(404, "Endpoint not found");
}
