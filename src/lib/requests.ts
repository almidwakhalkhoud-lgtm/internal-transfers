import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { HttpError } from "./auth";
import {
  requestInput,
  supplyInput,
  canSeeRequest,
  canSupply,
  numberFor,
  renamable,
  type RequestLine,
  type SnapshotLine,
} from "./domain";
import { insertTransfer, announceTransfer } from "./transfers";
import { sendPush } from "./push";
type User = NonNullable<
  Awaited<ReturnType<typeof import("./auth").currentUser>>
>;
const today = () =>
  new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }));
// Administrators and the people working at a location hear about its requests.
const notifyLocation = (
  locationId: string,
  message: { title: string; body: string; url: string },
) =>
  sendPush(
    {
      user: {
        active: true,
        OR: [{ role: "ADMIN" }, { locations: { some: { id: locationId } } }],
      },
    },
    message,
  ).catch((e) => console.error("Request notification failed", e));
export async function createRequest(user: User, input: unknown) {
  const parsed = requestInput.safeParse(input);
  if (!parsed.success)
    throw new HttpError(
      400,
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  const data = parsed.data;
  const created = await db.$transaction(async (tx) => {
    const locations = await tx.location.findMany({
      where: { id: { in: [data.requesterId, data.supplierId] }, active: true },
    });
    if (locations.length !== 2)
      throw new HttpError(400, "Choose active locations");
    // Items are requested for one of the requester's own locations.
    if (
      user.role !== "ADMIN" &&
      !user.locations.some((l) => l.id === data.requesterId)
    )
      throw new HttpError(403, "Location access denied");
    const products = await tx.product.findMany({
      where: { id: { in: data.lines.map((l) => l.productId) }, active: true },
    });
    const lines: RequestLine[] = data.lines.map((line) => {
      const p = products.find((p) => p.id === line.productId);
      if (!p) throw new HttpError(400, "A product is unavailable");
      if (line.unit !== "" && !p.units.includes(line.unit))
        throw new HttpError(400, `Invalid unit for ${p.code}`);
      if (line.description && !renamable(p.code))
        throw new HttpError(400, `The name of ${p.code} cannot be changed`);
      return {
        productId: p.id,
        code: p.code,
        description: line.description || p.description,
        quantity: line.quantity,
        unit: line.unit,
        ...(line.note ? { note: line.note } : {}),
      };
    });
    const { value } = await tx.sequence.upsert({
      where: { id: "request" },
      create: { id: "request", value: 1, prefix: "REQ" },
      update: { value: { increment: 1 } },
    });
    const requester = locations.find((l) => l.id === data.requesterId)!;
    const supplier = locations.find((l) => l.id === data.supplierId)!;
    const request = await tx.stockRequest.create({
      data: {
        number: numberFor(value, "REQ"),
        creatorId: user.id,
        creatorName: user.name,
        requesterId: requester.id,
        supplierId: supplier.id,
        requester: requester.name,
        supplier: supplier.name,
        remarks: data.remarks,
        lines,
      },
    });
    await tx.audit.create({
      data: {
        actor: user.id,
        action: "REQUEST_CREATED",
        target: request.id,
        detail: {
          number: request.number,
          from: supplier.name,
          to: requester.name,
          lines: lines.length,
        },
      },
    });
    return request;
  });
  await notifyLocation(created.supplierId, {
    title: `${created.number} · ${created.requester} → ${created.supplier}`,
    body: `${created.creatorName} · ${(created.lines as RequestLine[]).length} items`,
    url: `/requests/${created.id}`,
  });
  return created;
}
export async function findRequest(user: User, id: string) {
  const r = await db.stockRequest.findUnique({
    where: { id },
    include: { transfer: { select: { id: true, number: true, pdf: true } } },
  });
  if (!r) throw new HttpError(404, "Request not found");
  if (!canSeeRequest(user, r))
    throw new HttpError(403, "Request access denied");
  return r;
}
// The supplier's decisions are matched to the request's lines by position, so
// a stale page can never apply one line's quantity to another.
function applySupply(lines: RequestLine[], input: unknown) {
  const v = supplyInput.parse(input);
  if (v.lines.length !== lines.length)
    throw new HttpError(409, "The request changed. Refresh and retry.");
  return {
    remarks: v.remarks?.trim() ?? "",
    lines: lines.map((line, i): RequestLine => {
      const d = v.lines[i];
      const rest = { ...line };
      delete rest.supplied;
      delete rest.removed;
      return d.removed
        ? { ...rest, removed: true }
        : { ...rest, supplied: d.supplied };
    }),
  };
}
async function openForSupply(
  tx: Prisma.TransactionClient,
  user: User,
  id: string,
) {
  const r = await tx.stockRequest.findUnique({ where: { id } });
  if (!r) throw new HttpError(404, "Request not found");
  if (!canSupply(user, r)) throw new HttpError(403, "Location access denied");
  if (r.status !== "OPEN")
    throw new HttpError(409, "This request is already closed");
  return r;
}
// Keeps the supplier's work so far without sending anything.
export async function saveSupply(user: User, id: string, input: unknown) {
  await db.$transaction(async (tx) => {
    const r = await openForSupply(tx, user, id);
    const { lines } = applySupply(r.lines as RequestLine[], input);
    const result = await tx.stockRequest.updateMany({
      where: { id, status: "OPEN", updatedAt: r.updatedAt },
      data: { lines },
    });
    if (result.count !== 1)
      throw new HttpError(409, "The request changed. Refresh and retry.");
  });
}
// Confirms what the supplier sends and creates the transfer from the supplier
// to the requester with those quantities. Unavailable lines are left out.
export async function fulfillRequest(user: User, id: string, input: unknown) {
  try {
    const transfer = await db.$transaction(
      async (tx) => {
        const r = await openForSupply(tx, user, id);
        const { lines, remarks } = applySupply(r.lines as RequestLine[], input);
        const sending = lines.filter((l) => !l.removed);
        if (!sending.length)
          throw new HttpError(
            400,
            "Keep at least one item, or decline the request.",
          );
        const locations = await tx.location.findMany({
          where: { id: { in: [r.supplierId, r.requesterId] }, active: true },
        });
        if (locations.length !== 2)
          throw new HttpError(400, "Choose active locations");
        const products = await tx.product.findMany({
          where: {
            id: { in: sending.map((l) => l.productId) },
            active: true,
          },
          include: { barcodes: true },
        });
        const snapshot: SnapshotLine[] = sending.map((line) => {
          const p = products.find((p) => p.id === line.productId);
          if (!p) throw new HttpError(400, "A product is unavailable");
          if (line.unit !== "" && !p.units.includes(line.unit))
            throw new HttpError(400, `Invalid unit for ${p.code}`);
          return {
            code: p.code,
            description: renamable(p.code) ? line.description : p.description,
            barcodes: p.barcodes.map((b) => b.value),
            quantity: line.supplied ?? line.quantity,
            unit: line.unit,
            ...(line.note ? { note: line.note } : {}),
          };
        });
        const { value } = await tx.sequence.upsert({
          where: { id: "transfer" },
          create: { id: "transfer", value: 1 },
          update: { value: { increment: 1 } },
        });
        const created = await insertTransfer(tx, user, {
          key: randomUUID(),
          sequence: value,
          source: locations.find((l) => l.id === r.supplierId)!,
          destination: locations.find((l) => l.id === r.requesterId)!,
          date: today(),
          remarks: [`Request ${r.number}`, remarks].filter(Boolean).join(" · "),
          lines: snapshot,
          detail: { request: r.number },
        });
        const result = await tx.stockRequest.updateMany({
          where: { id, status: "OPEN", updatedAt: r.updatedAt },
          data: {
            lines,
            status: "FULFILLED",
            closedById: user.id,
            closedAt: new Date(),
            transferId: created.id,
          },
        });
        if (result.count !== 1)
          throw new HttpError(409, "The request changed. Refresh and retry.");
        await tx.audit.create({
          data: {
            actor: user.id,
            action: "REQUEST_FULFILLED",
            target: r.id,
            detail: {
              number: r.number,
              transfer: created.number,
              sent: sending.length,
              unavailable: lines.length - sending.length,
            },
          },
        });
        return { ...created, requesterId: r.requesterId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await announceTransfer(transfer);
    await notifyLocation(transfer.requesterId, {
      title: `${transfer.number} · ${transfer.source} → ${transfer.destination}`,
      body: `${transfer.creatorName} · ${(transfer.lines as SnapshotLine[]).length} items · ${transfer.total}`,
      url: `/transfers/${transfer.id}`,
    });
    return transfer;
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(e.code)
    )
      throw new HttpError(409, "The request changed. Refresh and retry.");
    throw e;
  }
}
// The requester withdraws a request, or the supplier turns it down.
export async function closeRequest(
  user: User,
  id: string,
  status: "CANCELLED" | "DECLINED",
  reason: string,
) {
  await db.$transaction(async (tx) => {
    const r = await tx.stockRequest.findUnique({ where: { id } });
    if (!r) throw new HttpError(404, "Request not found");
    const allowed =
      status === "DECLINED"
        ? canSupply(user, r)
        : user.role === "ADMIN" || r.creatorId === user.id;
    if (!allowed) throw new HttpError(403, "Request access denied");
    const result = await tx.stockRequest.updateMany({
      where: { id, status: "OPEN" },
      data: { status, closedById: user.id, closedAt: new Date() },
    });
    if (result.count !== 1)
      throw new HttpError(409, "This request is already closed");
    await tx.audit.create({
      data: {
        actor: user.id,
        action:
          status === "DECLINED" ? "REQUEST_DECLINED" : "REQUEST_CANCELLED",
        target: r.id,
        detail: { number: r.number, reason },
      },
    });
  });
}
