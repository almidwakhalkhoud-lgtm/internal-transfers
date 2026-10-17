import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export async function currentUser() {
  const token = (await cookies()).get("buzz-session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hash(token) },
    include: { user: { include: { locations: true } } },
  });
  if (!session || session.expires < new Date() || !session.user.active)
    return null;
  return session.user;
}
export async function requireUser(admin = false) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in");
  if (admin && user.role !== "ADMIN")
    throw new HttpError(403, "Administrator access required");
  return user;
}
export async function sameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin || origin !== (process.env.APP_ORIGIN ?? "http://127.0.0.1:3100"))
    throw new HttpError(403, "Invalid request origin");
}
export async function createSession(
  userId: string,
  expectedAccessHash?: string | null,
) {
  const token = randomBytes(32).toString("hex");
  await db.$transaction(async (tx) => {
    // Serialize login with credential rotation: a revoked code cannot create
    // a fresh session after the administrator has invalidated old sessions.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (
      !user?.active ||
      (expectedAccessHash !== undefined &&
        user.accessHash !== expectedAccessHash)
    )
      throw new HttpError(401, "Invalid access credentials");
    await tx.session.create({
      data: {
        id: hash(token),
        userId,
        expires: new Date(Date.now() + 8 * 3600000),
      },
    });
  });
  (await cookies()).set("buzz-session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.APP_ORIGIN?.startsWith("https:"),
    path: "/",
    maxAge: 8 * 3600,
  });
}
export async function audit(
  actor: string,
  action: string,
  target: string,
  detail: object = {},
) {
  await db.audit.create({ data: { actor, action, target, detail } });
}
