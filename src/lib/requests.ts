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
import { insertTransfer } from "./transfers";
import { sendPush } from "./push";
type User = NonNullable<
  Awaited<ReturnType<typeof import("./auth").currentUser>>
>;
const today = () =>
  new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }));
// Administrators and the people working at a location hear about its requests.
const notifyLocation = (
  locationId: string,
  message: (locale: "fa" | "en") => {
    title: string;
    body: string;
    url: string;
  },
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
    if (data.draftId)
      await tx.requestDraft.deleteMany({
        where: { id: data.draftId, userId: user.id },
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
  const count = (created.lines as RequestLine[]).length;
  await notifyLocation(created.supplierId, (locale) =>
    locale === "fa"
      ? {
          title: `طلبیهٔ جدید ${created.number}`,
          body: [
            `${created.requester} از ${created.supplier} درخواست کرده`,
            `${count} قلم · ${created.creatorName}`,
            "برای دیدن و پاسخ، روی این پیام بزنید.",
          ].join("\n"),
          url: `/requests/${created.id}`,
        }
      : {
          title: `New request ${created.number}`,
          body: [
            `${created.requester} asks ${created.supplier}`,
            `${count} ${count === 1 ? "item" : "items"} · ${created.creatorName}`,
            "Tap to view and reply.",
          ].join("\n"),
          url: `/requests/${created.id}`,
        },
  );
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
// The supplier's decisions are matched to the requested lines by position, so
// a stale page can never apply one line's quantity to another. The supplier
// may send a line in another of its product's units and may add items; the
// added items replace any saved before.
async function applySupply(
  tx: Prisma.TransactionClient,
  saved: RequestLine[],
  input: unknown,
) {
  const v = supplyInput.parse(input);
  const asked = saved.filter((l) => !l.added);
  if (v.lines.length !== asked.length)
    throw new HttpError(409, "The request changed. Refresh and retry.");
  const products = await tx.product.findMany({
    where: {
      id: {
        in: [
          ...asked.map((l) => l.productId),
          ...v.added.map((l) => l.productId),
        ],
      },
    },
  });
  const unitOf = (productId: string, code: string, unit: string) => {
    const p = products.find((p) => p.id === productId);
    if (unit !== "" && !p?.units.includes(unit))
      throw new HttpError(400, `Invalid unit for ${code}`);
    return unit;
  };
  const decided = asked.map((line, i): RequestLine => {
    const d = v.lines[i];
    const rest = { ...line };
    delete rest.supplied;
    delete rest.removed;
    delete rest.supplyUnit;
    if (d.removed) return { ...rest, removed: true };
    const unit =
      d.unit === undefined
        ? line.unit
        : unitOf(line.productId, line.code, d.unit);
    return {
      ...rest,
      supplied: d.supplied,
      ...(unit !== line.unit ? { supplyUnit: unit } : {}),
    };
  });
  const added = v.added.map((a): RequestLine => {
    const p = products.find((p) => p.id === a.productId && p.active);
    if (!p) throw new HttpError(400, "A product is unavailable");
    if (a.description && !renamable(p.code))
      throw new HttpError(400, `The name of ${p.code} cannot be changed`);
    return {
      productId: p.id,
      code: p.code,
      description: a.description || p.description,
      quantity: "0",
      unit: unitOf(p.id, p.code, a.unit),
      supplied: a.supplied,
      added: true,
    };
  });
  return { remarks: v.remarks?.trim() ?? "", lines: [...decided, ...added] };
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
    const { lines } = await applySupply(tx, r.lines as RequestLine[], input);
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
        const { lines, remarks } = await applySupply(
          tx,
          r.lines as RequestLine[],
          input,
        );
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
          const unit = line.supplyUnit ?? line.unit;
          if (unit !== "" && !p.units.includes(unit))
            throw new HttpError(400, `Invalid unit for ${p.code}`);
          return {
            code: p.code,
            description: renamable(p.code) ? line.description : p.description,
            barcodes: p.barcodes.map((b) => b.value),
            quantity: line.supplied ?? line.quantity,
            unit,
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
              unavailable: lines.filter((l) => l.removed).length,
              added: lines.filter((l) => l.added).length,
            },
          },
        });
        return { ...created, requesterId: r.requesterId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
// Administrators remove a request at any stage. The audit log keeps a full
// copy; a transfer already created from it stays as it is.
export async function deleteRequest(user: User, id: string, reason: string) {
  if (user.role !== "ADMIN")
    throw new HttpError(403, "Administrator access required");
  await db.$transaction(async (tx) => {
    const r = await tx.stockRequest.findUnique({
      where: { id },
      include: { transfer: { select: { number: true } } },
    });
    if (!r) throw new HttpError(404, "Request not found");
    const result = await tx.stockRequest.deleteMany({
      where: { id, updatedAt: r.updatedAt },
    });
    if (result.count !== 1)
      throw new HttpError(409, "The request changed. Refresh and retry.");
    await tx.audit.create({
      data: {
        actor: user.id,
        action: "REQUEST_DELETED",
        target: r.id,
        detail: {
          number: r.number,
          from: r.supplier,
          to: r.requester,
          creatorId: r.creatorId,
          creatorName: r.creatorName,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          remarks: r.remarks,
          lines: r.lines as Prisma.InputJsonValue,
          transfer: r.transfer?.number ?? null,
          reason,
        },
      },
    });
  });
}
