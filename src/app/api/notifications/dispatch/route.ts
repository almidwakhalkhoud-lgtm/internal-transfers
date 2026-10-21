import { timingSafeEqual } from "node:crypto";
import { runNotificationTick } from "@/lib/push-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    secret.length < 32 ||
    Buffer.byteLength(authorization) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await runNotificationTick();
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "Dispatch failed; durable jobs will retry on the next invocation.",
      },
      { status: 503 },
    );
  }
}
export { GET as POST };
