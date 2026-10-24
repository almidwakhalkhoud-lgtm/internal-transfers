import { z } from "zod";
import { db } from "./db";
import { HttpError } from "./auth";
import { DEFAULT_NOTIFICATION_POLICY } from "./notification-policy";

export const notificationPolicySchema = z
  .object({
    intervalMinutes: z.number().int().min(1).max(1440),
    maxReminders: z.number().int().min(0).max(100).nullable(),
    requireDevice: z.boolean().optional(),
  })
  .strict();

export async function getNotificationPolicy() {
  const settings = await db.notificationSettings.findUnique({
    where: { id: "global" },
  });
  return settings
    ? {
        intervalMinutes: settings.intervalMinutes,
        maxReminders: settings.maxReminders,
        requireDevice: settings.requireDevice,
      }
    : { ...DEFAULT_NOTIFICATION_POLICY, requireDevice: true };
}

export async function saveNotificationPolicy(
  user: { id: string; role: string },
  input: unknown,
) {
  if (user.role !== "ADMIN")
    throw new HttpError(403, "Administrator access required");
  const policy = notificationPolicySchema.parse(input);
  const current = await getNotificationPolicy();
  const saved = {
    ...policy,
    requireDevice: policy.requireDevice ?? current.requireDevice,
  };
  await db.$transaction(async (tx) => {
    await tx.notificationSettings.upsert({
      where: { id: "global" },
      create: { id: "global", ...saved },
      update: saved,
    });
    await tx.audit.create({
      data: {
        actor: user.id,
        action: "NOTIFICATION_SETTINGS_UPDATED",
        target: "global",
        detail: saved,
      },
    });
  });
  return saved;
}
