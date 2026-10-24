-- Reminders were too frequent (every few minutes). Default to the first alert
-- plus at most two reminders six hours apart, and apply it to the current
-- setting; administrators can still change it in Settings.
ALTER TABLE "NotificationSettings" ALTER COLUMN "intervalMinutes" SET DEFAULT 360;
ALTER TABLE "NotificationSettings" ALTER COLUMN "maxReminders" SET DEFAULT 2;
UPDATE "NotificationSettings" SET "intervalMinutes" = 360, "maxReminders" = 2 WHERE "id" = 'global';

-- Devices must turn notifications on before the app can be used.
ALTER TABLE "NotificationSettings" ADD COLUMN "requireDevice" BOOLEAN NOT NULL DEFAULT true;
