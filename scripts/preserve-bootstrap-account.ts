import { PrismaClient, type Prisma } from "@prisma/client";
// One-time repair for the local UTF-8 database bootstrap. No credentials are logged or written to files.
const target = new PrismaClient();
const targetUrl = new URL(process.env.DATABASE_URL!);
if (
  targetUrl.pathname !== "/buzz_utf8" ||
  targetUrl.hostname !== "127.0.0.1" ||
  targetUrl.port !== "54329"
)
  throw new Error(
    "This repair only targets the known local UTF-8 bootstrap database",
  );
const sourceUrl = new URL(targetUrl);
sourceUrl.pathname = "/buzz";
const source = new PrismaClient({ datasourceUrl: sourceUrl.toString() });
if (await target.user.count())
  throw new Error("Target accounts already exist; refusing an automatic merge");
if (
  (await source.transfer.count()) ||
  (await source.draft.count()) ||
  (await source.location.count())
)
  throw new Error(
    "Bootstrap contains additional business records; a broader migration is needed",
  );
const otherChanges = await source.audit.count({
  where: { action: { notIn: ["LOGIN", "ADMIN_PROVISIONED"] } },
});
if (otherChanges)
  throw new Error(
    "Bootstrap has administrator changes that require an explicit migration",
  );
const users = await source.user.findMany();
if (users.length !== 1 || users[0].role !== "ADMIN")
  throw new Error("Expected exactly the original administrator account");
const sessions = await source.session.findMany({
  where: { expires: { gt: new Date() } },
});
const audits = await source.audit.findMany();
await target.$transaction(async (tx) => {
  for (const user of users) await tx.user.create({ data: user });
  if (sessions.length) await tx.session.createMany({ data: sessions });
  if (audits.length)
    await tx.audit.createMany({
      data: audits.map((a) => ({
        ...a,
        detail: a.detail as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
  await tx.audit.create({
    data: {
      actor: users[0].id,
      action: "BOOTSTRAP_ACCOUNT_PRESERVED",
      target: users[0].id,
      detail: {
        sourceDatabase: "buzz",
        targetDatabase: "buzz_utf8",
        sessionsPreserved: sessions.length,
      },
    },
  });
});
console.log(
  "The original administrator account, session expiry and audit history have been preserved.",
);
await source.$disconnect();
await target.$disconnect();
