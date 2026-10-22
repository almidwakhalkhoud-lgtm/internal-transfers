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
    include: {
      user: { include: { locations: true, viewLocations: true } },
    },
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
// APP_ORIGIN is the canonical origin; on Vercel the deployment, branch and
// production domains it assigns are accepted as well.
export function allowedOrigins() {
  const origins = [process.env.APP_ORIGIN ?? "http://127.0.0.1:3100"];
  for (const host of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ])
    if (host) origins.push(`https://${host}`);
  return origins;
}
export async function sameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin || !allowedOrigins().includes(origin))
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
  // Lax, not strict: a page opened from a link in another app (WhatsApp, a
  // bookmark) keeps that origin on every reload, and a strict cookie would be
  // withheld each time. Writes are guarded by sameOrigin() instead.
  (await cookies()).set("buzz-session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      !!process.env.VERCEL || process.env.APP_ORIGIN?.startsWith("https:"),
    path: "/",
    maxAge: 8 * 3600,
  });
}
// Where a request came from, for the audit log: address, rough place (Vercel
// adds the city and country headers) and the device and browser it used.
export async function requestOrigin() {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const device =
    [
      [/iPhone/, "iPhone"],
      [/iPad/, "iPad"],
      [/Android/, "Android"],
      [/Windows/, "Windows"],
      [/Mac OS X/, "Mac"],
      [/Linux/, "Linux"],
    ].find(([re]) => (re as RegExp).test(ua))?.[1] ?? "Unknown device";
  const browser =
    [
      [/Edg\//, "Edge"],
      [/OPR\//, "Opera"],
      [/SamsungBrowser/, "Samsung Internet"],
      [/Chrome\//, "Chrome"],
      [/Firefox\//, "Firefox"],
      [/Safari\//, "Safari"],
    ].find(([re]) => (re as RegExp).test(ua))?.[1] ?? "Unknown browser";
  const city = h.get("x-vercel-ip-city");
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip"),
    place: [city && decodeURIComponent(city), h.get("x-vercel-ip-country")]
      .filter(Boolean)
      .join(", "),
    device: `${device} · ${browser}`,
  };
}
export async function audit(
  actor: string,
  action: string,
  target: string,
  detail: object = {},
) {
  await db.audit.create({ data: { actor, action, target, detail } });
}
