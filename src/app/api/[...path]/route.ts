import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  audit,
  createSession,
  hash,
  HttpError,
  requireUser,
  sameOrigin,
} from "@/lib/auth";
import {
  allowedTransition,
  canAccess,
  identifier,
  numberFor,
  routeCode,
  sequenceOf,
  validateCatalog,
  type CatalogRow,
} from "@/lib/domain";
import { confirmTransfer, transferPdf } from "@/lib/transfers";
import { readFile, unlink } from "node:fs/promises";
import { hasMenu, menus, landingPage } from "@/lib/permissions";
import {
  chosenCodePattern,
  loginCodePattern,
  normalizeCode,
  codeDigest,
  prepareCode,
} from "@/lib/access-code";
import { randomBytes, timingSafeEqual } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PDF generation starts a browser; allow for a cold start on serverless hosts.
export const maxDuration = 60;
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  locale: true,
  menus: true,
  locations: true,
};
const summary = {
  id: true,
  number: true,
  source: true,
  destination: true,
  date: true,
  total: true,
  approval: true,
  confirmedAt: true,
  creator: { select: { name: true } },
};
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path.join("/");
    const method = req.method;
    if (method !== "GET") await sameOrigin();
    if (path === "login" && method === "POST") {
      const input = z
        .union([
          z.object({
            accessCode: z.string().trim().regex(loginCodePattern),
          }),
          z.object({ email: z.email(), password: z.string().min(1).max(256) }),
        ])
        .parse(await req.json());
      // A high entropy bearer secret is indexed only by its cryptographic digest.
      const codeMode = "accessCode" in input;
      const credentialHash = codeMode
        ? await codeDigest(input.accessCode)
        : hash(input.email.trim().toLowerCase());
      const user = codeMode
        ? await db.user.findFirst({
            where: {
              OR: [
                { accessHash: credentialHash },
                ...(input.accessCode.startsWith("BUZZ-") &&
                input.accessCode.length === 48
                  ? [{ accessHash: hash(input.accessCode) }]
                  : []),
              ],
            },
          })
        : await db.user.findUnique({
            where: { email: input.email.trim().toLowerCase() },
          });
      // Unknown random codes share a bounded time bucket instead of creating
      // an unbounded number of database rows controlled by unauthenticated input.
      const key = hash(
        user
          ? `login-user:${user.id}`
          : `unknown-login:${Math.floor(Date.now() / 900000)}`,
      );
      const attempt = await db.loginAttempt.upsert({
        where: { key },
        create: { key, attempts: 1, until: new Date(Date.now() + 15 * 60000) },
        update: { attempts: { increment: 1 } },
      });
      if (attempt.until > new Date() && attempt.attempts > 8)
        throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");
      if (attempt.until < new Date())
        await db.loginAttempt.update({
          where: { key },
          data: { attempts: 1, until: new Date(Date.now() + 15 * 60000) },
        });
      const valid = codeMode
        ? user?.accessVerifier
          ? await bcrypt.compare(
              normalizeCode(input.accessCode),
              user.accessVerifier,
            )
          : !!user
        : await bcrypt.compare(
            input.password,
            user?.password ??
              "$2b$12$k3DTHgLSO6zu9MyfEWH7mOk2dF62ukG5kM5xcRDgOhDB5DfK7D4wu",
          );
      if (
        !user ||
        !valid ||
        !user.active ||
        (!codeMode && (user.role !== "ADMIN" || user.accessHash !== null))
      )
        throw new HttpError(401, "Invalid access credentials");
      await db.loginAttempt.deleteMany({ where: { key } });
      await createSession(user.id, codeMode ? user.accessHash : null);
      await audit(user.id, "LOGIN", user.id);
      return NextResponse.json({ ok: true, next: landingPage(user) });
    }
    if (path === "setup" && method === "POST") {
      const input = z
        .object({
          token: z.string().length(64),
          name: z.string().trim().min(1).max(100),
          email: z.email(),
          password: z.string().min(12).max(128),
        })
        .parse(await req.json());
      let secret = process.env.BUZZ_SETUP_TOKEN?.trim() ?? "";
      if (!secret)
        try {
          secret = await readFile(
            process.env.BUZZ_TEST === "1"
              ? ".postgres/test-setup-token"
              : ".postgres/setup-token",
            "utf8",
          );
        } catch {
          throw new HttpError(
            403,
            "Provisioning is not enabled. Run npm run setup locally.",
          );
        }
      if (
        secret.length !== input.token.length ||
        !timingSafeEqual(Buffer.from(secret), Buffer.from(input.token))
      )
        throw new HttpError(403, "Invalid setup link");
      const password = await bcrypt.hash(input.password, 12);
      const created = await db.$transaction(
        async (tx) => {
          if (await tx.user.count({ where: { role: "ADMIN" } }))
            throw new HttpError(409, "An administrator already exists");
          const u = await tx.user.create({
            data: {
              email: input.email.toLowerCase(),
              name: input.name,
              password,
              role: "ADMIN",
            },
          });
          await tx.audit.create({
            data: {
              actor: u.id,
              action: "ADMIN_PROVISIONED",
              target: u.id,
              detail: {},
            },
          });
          return u;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await unlink(
        process.env.BUZZ_TEST === "1"
          ? ".postgres/test-setup-token"
          : ".postgres/setup-token",
      ).catch(() => {});
      await unlink(
        process.env.BUZZ_TEST === "1"
          ? ".postgres/test-admin-setup-link.txt"
          : ".postgres/admin-setup-link.txt",
      ).catch(() => {});
      await createSession(created.id);
      return NextResponse.json({ ok: true });
    }
    const user = await requireUser();
    if (path === "me") {
      if (method === "PATCH") {
        const { locale } = z
          .object({ locale: z.enum(["en", "fa"]) })
          .parse(await req.json());
        await db.user.update({ where: { id: user.id }, data: { locale } });
      }
      return NextResponse.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        locale: user.locale,
      });
    }
    if (path === "logout" && method === "POST") {
      const token = (await cookies()).get("buzz-session")?.value;
      if (token) await db.session.deleteMany({ where: { id: hash(token) } });
      (await cookies()).delete("buzz-session");
      return NextResponse.json({ ok: true });
    }
    const requiredMenu =
      path === "dashboard"
        ? "dashboard"
        : path === "drafts" ||
            path.startsWith("drafts/") ||
            (path === "transfers" && method === "POST")
          ? "new-transfer"
          : path.endsWith("/pdf") && hasMenu(user, "new-transfer")
            ? null
            : path.startsWith("transfers")
              ? "transfers"
              : path === "products"
                ? req.nextUrl.searchParams.has("exact")
                  ? "new-transfer"
                  : "products"
                : path === "locations" && method === "GET"
                  ? null
                  : null;
    if (requiredMenu && !hasMenu(user, requiredMenu))
      throw new HttpError(403, "You do not have access to this menu");
    if (
      path === "locations" &&
      method === "GET" &&
      user.role !== "ADMIN" &&
      !["locations", "new-transfer", "transfers"].some((m) => hasMenu(user, m))
    )
      throw new HttpError(403, "You do not have access to this menu");
    if (path === "locations" && method === "GET") {
      // Everyone may send to any active location; `mine` marks the ones a
      // transfer may leave from.
      const rows = await db.location.findMany({
        where: user.role === "ADMIN" ? {} : { active: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(
        rows.map((l) => ({
          ...l,
          mine:
            user.role === "ADMIN" || user.locations.some((m) => m.id === l.id),
        })),
      );
    }
    if (path === "products" && method === "GET") {
      const q = identifier(req.nextUrl.searchParams.get("q") ?? "");
      const exact = req.nextUrl.searchParams.has("exact");
      const where: Prisma.ProductWhereInput = {
        active: true,
        ...(exact
          ? { OR: [{ code: q }, { barcodes: { some: { value: q } } }] }
          : q
            ? {
                OR: [
                  { code: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                  { barcodes: { some: { value: { contains: q } } } },
                ],
              }
            : {}),
      };
      const take = 50,
        page = Math.max(0, Number(req.nextUrl.searchParams.get("page")) || 0);
      return NextResponse.json({
        items: await db.product.findMany({
          where,
          include: { barcodes: true },
          take,
          skip: page * take,
          orderBy: { code: "asc" },
        }),
        count: await db.product.count({ where }),
      });
    }
    const access: Prisma.TransferWhereInput =
      user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { creatorId: user.id },
              { sourceId: { in: user.locations.map((l) => l.id) } },
              { destinationId: { in: user.locations.map((l) => l.id) } },
            ],
          };
    if (path === "dashboard" && method === "GET") {
      const [total, pending, approved, recent, products] = await Promise.all([
        db.transfer.count({ where: access }),
        db.transfer.count({
          where: { AND: [access, { approval: "PENDING" }] },
        }),
        db.transfer.count({
          where: { AND: [access, { approval: "APPROVED" }] },
        }),
        db.transfer.findMany({
          where: access,
          select: summary,
          orderBy: { confirmedAt: "desc" },
          take: 8,
        }),
        db.product.count({ where: { active: true } }),
      ]);
      return NextResponse.json({ total, pending, approved, recent, products });
    }
    if (path === "drafts") {
      if (method === "GET")
        return NextResponse.json(
          await db.draft.findMany({
            where: { userId: user.id },
            orderBy: { updatedAt: "desc" },
            take: 20,
          }),
        );
      if (method === "POST") {
        const input = z
          .object({ id: z.uuid(), data: z.record(z.string(), z.unknown()) })
          .parse(await req.json());
        const existing = await db.draft.findUnique({ where: { id: input.id } });
        if (existing && existing.userId !== user.id)
          throw new HttpError(403, "Draft access denied");
        if (await db.transfer.findUnique({ where: { key: input.id } }))
          throw new HttpError(409, "Already confirmed");
        const data = input.data as Prisma.InputJsonObject;
        const route = await db.location.findMany({
          where: {
            id: {
              in: [data.sourceId, data.destinationId].filter(
                (id): id is string => typeof id === "string",
              ),
            },
          },
        });
        const source = route.find((l) => l.id === data.sourceId);
        const destination = route.find((l) => l.id === data.destinationId);
        const draft = await db.$transaction(async (tx) => {
          const seq = existing
            ? await tx.sequence.findUnique({ where: { id: "transfer" } })
            : await tx.sequence.upsert({
                where: { id: "transfer" },
                create: { id: "transfer", value: 1 },
                update: { value: { increment: 1 } },
              });
          const prefix =
            source && destination
              ? routeCode(source.name, destination.name)
              : (seq?.prefix ?? "TRF");
          const number = numberFor(
            existing ? sequenceOf(existing.number) : seq!.value,
            prefix,
          );
          if (existing)
            return tx.draft.update({
              where: { id: input.id },
              data: { data, number },
            });
          return tx.draft.create({
            data: { id: input.id, userId: user.id, number, data },
          });
        });
        return NextResponse.json(draft);
      }
    }
    const draftMatch = path.match(/^drafts\/([^/]+)$/);
    if (draftMatch && method === "DELETE") {
      await db.$transaction(async (tx) => {
        const draft = await tx.draft.findUnique({
          where: { id: draftMatch[1] },
        });
        if (!draft || draft.userId !== user.id)
          throw new HttpError(404, "Draft not found");
        await tx.draft.delete({ where: { id: draft.id } });
        await tx.audit.create({
          data: {
            actor: user.id,
            action: "DRAFT_DELETED",
            target: draft.id,
            detail: { number: draft.number },
          },
        });
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "transfers" && method === "POST") {
      const t = await confirmTransfer(user, await req.json());
      try {
        await transferPdf(user, t.id);
      } catch {
        return NextResponse.json({
          id: t.id,
          number: t.number,
          pdfReady: false,
        });
      }
      return NextResponse.json({ id: t.id, number: t.number, pdfReady: true });
    }
    if (path === "transfers" && method === "GET") {
      const q = req.nextUrl.searchParams;
      const page = Math.max(0, Number(q.get("page")) || 0);
      const where: Prisma.TransferWhereInput = {
        AND: [access],
        number: { contains: q.get("q") ?? "", mode: "insensitive" },
        ...(q.get("status")
          ? {
              approval: z
                .enum(["PENDING", "APPROVED", "REJECTED", "RECEIVED"])
                .parse(q.get("status")),
            }
          : {}),
        ...(q.get("source") ? { sourceId: q.get("source")! } : {}),
        ...(q.get("destination")
          ? { destinationId: q.get("destination")! }
          : {}),
        ...(q.get("creator") && user.role === "ADMIN"
          ? { creatorId: q.get("creator")! }
          : {}),
        ...(q.get("from") || q.get("to")
          ? {
              date: {
                ...(q.get("from") ? { gte: new Date(q.get("from")!) } : {}),
                ...(q.get("to") ? { lte: new Date(q.get("to")!) } : {}),
              },
            }
          : {}),
      };
      return NextResponse.json({
        items: await db.transfer.findMany({
          where,
          select: summary,
          orderBy: { confirmedAt: "desc" },
          take: 25,
          skip: page * 25,
        }),
        count: await db.transfer.count({ where }),
      });
    }
    const match = path.match(/^transfers\/([^/]+)(\/pdf)?$/);
    if (match) {
      const t = await db.transfer.findUnique({
        where: { id: match[1] },
        include: { creator: { select: { name: true } } },
      });
      if (!t) throw new HttpError(404, "Transfer not found");
      if (!canAccess(user, t))
        throw new HttpError(403, "Transfer access denied");
      if (match[2] && method === "GET") {
        const { buffer } = await transferPdf(user, t.id);
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `${req.nextUrl.searchParams.has("inline") ? "inline" : "attachment"}; filename="${t.number}.pdf"`,
            "Cache-Control": "private, no-store",
          },
        });
      }
      if (method === "GET") {
        const { pdf, ...rest } = t;
        return NextResponse.json({ ...rest, pdfReady: !!pdf });
      }
      if (method === "PATCH") {
        await requireUser(true);
        const { approval } = z
          .object({ approval: z.enum(["APPROVED", "REJECTED", "RECEIVED"]) })
          .parse(await req.json());
        if (!allowedTransition(t.approval, approval))
          throw new HttpError(409, "Invalid status transition");
        await db.$transaction(async (tx) => {
          const result = await tx.transfer.updateMany({
            where: { id: t.id, approval: t.approval },
            data: { approval },
          });
          if (result.count !== 1)
            throw new HttpError(409, "Status changed. Refresh and retry.");
          await tx.audit.create({
            data: {
              actor: user.id,
              action: approval,
              target: t.id,
              detail: { from: t.approval },
            },
          });
        });
        return NextResponse.json({ ok: true });
      }
      if (method === "DELETE") {
        await requireUser(true);
        const { reason } = z
          .object({ reason: z.string().trim().max(500).optional() })
          .parse(await req.json().catch(() => ({})));
        await db.$transaction(async (tx) => {
          // The document guard trigger only permits deletion inside a
          // transaction that opted in; direct deletes stay rejected.
          await tx.$queryRaw`SELECT set_config('buzz.transfer_delete', 'allowed', true)`;
          const result = await tx.transfer.deleteMany({ where: { id: t.id } });
          if (result.count !== 1)
            throw new HttpError(409, "Transfer changed. Refresh and retry.");
          await tx.audit.create({
            data: {
              actor: user.id,
              action: "TRANSFER_DELETED",
              target: t.id,
              detail: {
                number: t.number,
                source: t.source,
                destination: t.destination,
                date: t.date.toISOString(),
                confirmedAt: t.confirmedAt.toISOString(),
                creatorId: t.creatorId,
                creatorName: t.creatorName,
                approval: t.approval,
                remarks: t.remarks,
                total: t.total.toString(),
                lines: t.lines as Prisma.InputJsonValue,
                pdfHash: t.pdfHash,
                reason: reason ?? "",
              },
            },
          });
        });
        return NextResponse.json({ ok: true });
      }
    }
    await requireUser(true);
    if (path.startsWith("products/") && method === "PATCH") {
      const id = path.split("/")[1];
      const v = z
        .object({
          description: z.string().trim().min(1).max(2000),
          barcodes: z.array(z.string().trim().min(1).max(150)),
          units: z.array(z.string().trim().min(1).max(100)),
        })
        .parse(await req.json());
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(8001)`;
        const product = await tx.product.findUniqueOrThrow({
          where: { id },
          include: { barcodes: true },
        });
        const collision = await tx.product.findFirst({
          where: {
            NOT: { id },
            OR: [
              { code: { in: v.barcodes } },
              {
                barcodes: {
                  some: { value: { in: [product.code, ...v.barcodes] } },
                },
              },
            ],
          },
        });
        if (collision)
          throw new HttpError(409, "Identifiers conflict with another product");
        await tx.product.update({
          where: { id },
          data: {
            description: v.description,
            units: [...new Set(v.units)],
            barcodes: {
              deleteMany: {},
              create: [...new Set(v.barcodes)].map((value) => ({ value })),
            },
          },
        });
        await tx.audit.create({
          data: {
            actor: user.id,
            action: "PRODUCT_UPDATED",
            target: id,
            detail: { before: JSON.parse(JSON.stringify(product)), after: v },
          },
        });
      });
      return NextResponse.json({ ok: true });
    }
    if (path === "products" && method === "POST") {
      const v = z
        .object({
          code: z
            .string()
            .transform(identifier)
            .pipe(z.string().min(1).max(150)),
          description: z.string().trim().min(1).max(2000),
          barcodes: z.array(z.string().trim().min(1).max(150)),
          units: z.array(z.string().trim().min(1).max(100)),
        })
        .parse(await req.json());
      const barcodes = [...new Set(v.barcodes)];
      const product = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(8001)`;
        const collision = await tx.product.findFirst({
          where: {
            OR: [
              { code: { in: [v.code, ...barcodes] } },
              { barcodes: { some: { value: { in: [v.code, ...barcodes] } } } },
            ],
          },
        });
        if (collision)
          throw new HttpError(
            409,
            "This code or barcode already belongs to a product",
          );
        const created = await tx.product.create({
          data: {
            code: v.code,
            description: v.description,
            units: [...new Set(v.units)],
            source: "MANUAL",
            barcodes: { create: barcodes.map((value) => ({ value })) },
          },
        });
        await tx.audit.create({
          data: {
            actor: user.id,
            action: "PRODUCT_CREATED",
            target: created.id,
            detail: v,
          },
        });
        return created;
      });
      return NextResponse.json(product);
    }
    if (path === "users") {
      if (method === "GET")
        return NextResponse.json(
          await db.user.findMany({
            select: userSelect,
            orderBy: { name: "asc" },
          }),
        );
      if (method === "POST") {
        const v = z
          .object({
            name: z.string().min(1).max(100),
            email: z.email(),
            accessCode: z.string().trim().regex(chosenCodePattern),
            menus: z
              .array(z.enum(menus))
              .max(5)
              .default([...menus]),
            role: z.enum(["ADMIN", "STAFF"]),
            locationIds: z.array(z.string()),
          })
          .parse(await req.json());
        const credentials = await prepareCode(v.accessCode);
        if (
          await db.user.findUnique({
            where: { accessHash: credentials.accessHash },
          })
        )
          throw new HttpError(409, "This access code is already assigned.");
        const created = await db.user.create({
          data: {
            name: v.name,
            email: v.email.toLowerCase().trim(),
            password: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
            ...credentials,
            menus: v.menus,
            role: v.role,
            locations: { connect: v.locationIds.map((id) => ({ id })) },
          },
          select: userSelect,
        });
        await audit(user.id, "USER_CREATED", created.id);
        return NextResponse.json(created, {
          headers: { "Cache-Control": "no-store" },
        });
      }
    }
    if (path.startsWith("users/") && method === "PATCH") {
      const id = path.split("/")[1];
      const v = z
        .object({
          menus: z.array(z.enum(menus)).max(5).optional(),
          accessCode: z.string().trim().regex(chosenCodePattern).optional(),
          revokeCode: z.boolean().optional(),
          name: z.string().min(1).max(100).optional(),
          active: z.boolean().optional(),
          password: z.string().min(12).max(128).optional(),
          locationIds: z.array(z.string()).optional(),
        })
        .parse(await req.json());
      if (id === user.id && v.active === false)
        throw new HttpError(400, "You cannot deactivate yourself");
      if (v.accessCode && v.revokeCode)
        throw new HttpError(400, "Choose either a new code or revocation.");
      const credentials = v.accessCode
        ? await prepareCode(v.accessCode)
        : undefined;
      if (credentials) {
        const existing = await db.user.findUnique({
          where: { accessHash: credentials.accessHash },
        });
        if (existing && existing.id !== id)
          throw new HttpError(409, "This access code is already assigned.");
      }
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: {
            name: v.name,
            menus: v.menus,
            ...(credentials
              ? credentials
              : v.revokeCode
                ? { accessHash: hash(randomBytes(32)), accessVerifier: null }
                : {}),
            active: v.active,
            ...(v.password
              ? { password: await bcrypt.hash(v.password, 12) }
              : {}),
            ...(v.locationIds
              ? { locations: { set: v.locationIds.map((id) => ({ id })) } }
              : {}),
          },
        });
        if (
          v.password ||
          v.active === false ||
          v.accessCode ||
          v.revokeCode ||
          v.menus ||
          v.locationIds
        )
          await tx.session.deleteMany({ where: { userId: id } });
        await tx.audit.create({
          data: {
            actor: user.id,
            action: "USER_UPDATED",
            target: id,
            detail: {
              passwordReset: !!v.password,
              codeRotated: !!v.accessCode,
              codeRevoked: !!v.revokeCode,
              menus: v.menus,
            },
          },
        });
      });
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (path === "locations" && method === "POST") {
      const v = z
        .object({ name: z.string().trim().min(1).max(100) })
        .parse(await req.json());
      const l = await db.location.create({ data: v });
      await audit(user.id, "LOCATION_CREATED", l.id);
      return NextResponse.json(l);
    }
    if (path.startsWith("locations/") && method === "PATCH") {
      const v = z
        .object({
          name: z.string().trim().min(1).max(100).optional(),
          active: z.boolean().optional(),
        })
        .parse(await req.json());
      const l = await db.location.update({
        where: { id: path.split("/")[1] },
        data: v,
      });
      await audit(user.id, "LOCATION_UPDATED", l.id);
      return NextResponse.json(l);
    }
    if (path === "settings") {
      if (method === "GET")
        return NextResponse.json(
          (await db.sequence.findUnique({ where: { id: "transfer" } })) ?? {
            value: 0,
            prefix: "TRF",
          },
        );
      if (method === "PATCH") {
        const v = z
          .object({
            prefix: z.string().regex(/^[A-Z]{1,8}$/),
            nextValue: z.number().int().positive().max(2147483647).optional(),
          })
          .parse(await req.json());
        await db.$transaction(async (tx) => {
          const seq = await tx.sequence.upsert({
            where: { id: "transfer" },
            create: { id: "transfer", value: 0 },
            update: { value: { increment: 0 } },
          });
          if (v.nextValue !== undefined && v.nextValue <= seq.value)
            throw new HttpError(
              400,
              "The next number must be greater than the last reserved number",
            );
          await tx.sequence.update({
            where: { id: "transfer" },
            data: {
              prefix: v.prefix,
              ...(v.nextValue === undefined ? {} : { value: v.nextValue - 1 }),
            },
          });
        });
        await audit(user.id, "SETTINGS_UPDATED", "transfer", v);
        return NextResponse.json({ ok: true });
      }
    }
    if (path === "audit" && method === "GET") {
      const page = Math.max(
        0,
        Number(req.nextUrl.searchParams.get("page")) || 0,
      );
      return NextResponse.json({
        items: await db.audit.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          skip: page * 50,
        }),
        count: await db.audit.count(),
      });
    }
    if (path === "catalog/conflicts" && method === "GET") {
      const page = Math.max(
        0,
        Number(req.nextUrl.searchParams.get("page")) || 0,
      );
      const items = await db.catalogConflict.findMany({
        where: { resolved: false },
        take: 50,
        skip: page * 50,
        orderBy: { createdAt: "desc" },
      });
      const products = await db.product.findMany({
        where: { code: { in: items.map((c) => c.code) } },
        include: { barcodes: true },
      });
      return NextResponse.json({
        items: items.map((c) => {
          const current = products.find((p) => p.code === c.code);
          return {
            ...c,
            current: current ?? null,
            currentVersion: current?.updatedAt.toISOString() ?? null,
          };
        }),
        count: await db.catalogConflict.count({ where: { resolved: false } }),
      });
    }
    if (path === "catalog/import" && method === "POST") {
      const { rows, source } = z
        .object({
          rows: z
            .array(
              z.object({
                code: z.string().trim().min(1).max(150),
                description: z.string().trim().min(1).max(2000),
                barcodes: z.array(z.string().trim().min(1).max(150)),
                units: z.array(z.string().trim().min(1).max(100)),
              }),
            )
            .min(1)
            .max(30000),
          source: z.enum(["ITEMS.xls", "mehdiali.om export"]),
        })
        .parse(await req.json());
      const errors = validateCatalog(rows);
      if (errors.length)
        throw new HttpError(400, errors.slice(0, 10).join("; "));
      let imported = 0,
        conflicts = 0;
      await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(8001)`;
          for (const row of rows) {
            const existing = await tx.product.findUnique({
              where: { code: row.code },
              include: { barcodes: true },
            });
            const collision = await tx.product.findFirst({
              where: {
                OR: [
                  { code: { in: row.barcodes } },
                  {
                    barcodes: {
                      some: { value: { in: [row.code, ...row.barcodes] } },
                    },
                  },
                ],
                NOT: { code: row.code },
              },
              include: { barcodes: true },
            });
            if (existing || collision) {
              const old = existing ?? collision!;
              const same =
                old.code === row.code &&
                old.description === row.description &&
                JSON.stringify([...old.units].sort()) ===
                  JSON.stringify([...row.units].sort()) &&
                JSON.stringify(old.barcodes.map((b) => b.value).sort()) ===
                  JSON.stringify([...row.barcodes].sort());
              if (!same) {
                await tx.catalogConflict.create({
                  data: {
                    code: row.code,
                    existing: JSON.parse(JSON.stringify(old)),
                    proposed: row,
                    source,
                  },
                });
                conflicts++;
              }
              continue;
            }
            await tx.product.create({
              data: {
                code: row.code,
                description: row.description,
                units: row.units,
                source,
                barcodes: { create: row.barcodes.map((value) => ({ value })) },
              },
            });
            imported++;
          }
          await tx.audit.create({
            data: {
              actor: user.id,
              action: "CATALOG_IMPORTED",
              target: source,
              detail: { imported, conflicts },
            },
          });
        },
        {
          timeout: 120000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
      return NextResponse.json({ imported, conflicts });
    }
    if (path.startsWith("catalog/conflicts/") && method === "POST") {
      const { accept, expectedVersion } = z
        .object({
          accept: z.boolean(),
          expectedVersion: z.iso.datetime().nullable(),
        })
        .parse(await req.json());
      const conflict = await db.catalogConflict.findUniqueOrThrow({
        where: { id: path.split("/")[2] },
      });
      if (conflict.resolved) throw new HttpError(409, "Already resolved");
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(8001)`;
        const fresh = await tx.catalogConflict.findUniqueOrThrow({
          where: { id: conflict.id },
        });
        if (fresh.resolved) throw new HttpError(409, "Already resolved");
        const current = await tx.product.findUnique({
          where: { code: conflict.code },
        });
        if ((current?.updatedAt.toISOString() ?? null) !== expectedVersion)
          throw new HttpError(
            409,
            "Product changed. Refresh the conflict review before applying changes.",
          );
        if (accept) {
          const row = conflict.proposed as CatalogRow;
          const collisions = await tx.product.findFirst({
            where: {
              NOT: { code: row.code },
              OR: [
                { code: { in: row.barcodes } },
                {
                  barcodes: {
                    some: { value: { in: [row.code, ...row.barcodes] } },
                  },
                },
              ],
            },
          });
          if (collisions)
            throw new HttpError(
              409,
              "Resolve the identifier collision manually first",
            );
          await tx.product.upsert({
            where: { code: row.code },
            create: {
              ...row,
              barcodes: { create: row.barcodes.map((value) => ({ value })) },
              source: conflict.source,
            },
            update: {
              description: row.description,
              units: row.units,
              source: conflict.source,
              barcodes: {
                deleteMany: {},
                create: row.barcodes.map((value) => ({ value })),
              },
            },
          });
        }
        await tx.catalogConflict.update({
          where: { id: conflict.id },
          data: { resolved: true },
        });
        await tx.audit.create({
          data: {
            actor: user.id,
            action: "CONFLICT_RESOLVED",
            target: conflict.id,
            detail: { accept },
          },
        });
      });
      return NextResponse.json({ ok: true });
    }
    throw new HttpError(404, "Endpoint not found");
  } catch (e) {
    if (e instanceof HttpError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof z.ZodError)
      return NextResponse.json(
        { error: "Invalid input. Please check the entered fields." },
        { status: 400 },
      );
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return NextResponse.json(
        { error: "This identifier is already in use" },
        { status: 409 },
      );
    console.error(
      "BUZZ request failed",
      e instanceof Error ? e.name : "Unknown error",
    );
    return NextResponse.json(
      {
        error:
          "The operation could not be completed. Your entered data is retained; please retry.",
      },
      { status: 500 },
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
