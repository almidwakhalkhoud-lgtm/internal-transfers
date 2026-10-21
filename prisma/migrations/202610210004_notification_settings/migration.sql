CREATE TABLE "NotificationSettings" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
  "maxReminders" INTEGER,
  CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationSettings_singleton" CHECK ("id" = 'global'),
  CONSTRAINT "NotificationSettings_interval" CHECK ("intervalMinutes" BETWEEN 1 AND 1440),
  CONSTRAINT "NotificationSettings_reminders" CHECK ("maxReminders" IS NULL OR "maxReminders" BETWEEN 0 AND 100)
);
INSERT INTO "NotificationSettings" ("id") VALUES ('global');
ALTER TABLE "PushDelivery" ADD COLUMN "successes" INTEGER NOT NULL DEFAULT 0;
-- Old attempts include failures. Only the latest successful send is known for certain.
-- Preserve it conservatively; default unlimited reminders remain unchanged.
UPDATE "PushDelivery" SET "successes" = 1 WHERE "lastSuccessAt" IS NOT NULL;
