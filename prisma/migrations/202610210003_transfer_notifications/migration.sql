CREATE TABLE "TransferNotification" (
  "id" TEXT PRIMARY KEY,
  "transferId" TEXT NOT NULL UNIQUE REFERENCES "Transfer"("id") ON DELETE CASCADE,
  "destinationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedBy" TEXT,
  "acknowledgedName" TEXT,
  "closedAt" TIMESTAMP(3)
);
CREATE INDEX "TransferNotification_destinationId_acknowledgedAt_closedAt_cre_idx"
  ON "TransferNotification"("destinationId", "acknowledgedAt", "closedAt", "createdAt");
CREATE INDEX "TransferNotification_acknowledgedAt_closedAt_createdAt_idx"
  ON "TransferNotification"("acknowledgedAt", "closedAt", "createdAt");
ALTER TABLE "PushSubscription" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
CREATE TABLE "PushDelivery" (
  "id" TEXT PRIMARY KEY,
  "notificationId" TEXT NOT NULL REFERENCES "TransferNotification"("id") ON DELETE CASCADE,
  "subscriptionId" TEXT NOT NULL REFERENCES "PushSubscription"("id") ON DELETE CASCADE,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "lastSuccessAt" TIMESTAMP(3),
  "lastError" TEXT,
  "lockToken" TEXT,
  "lockedUntil" TIMESTAMP(3),
  UNIQUE ("notificationId", "subscriptionId")
);
CREATE INDEX "PushDelivery_nextAttemptAt_lockedUntil_idx" ON "PushDelivery"("nextAttemptAt", "lockedUntil");
CREATE TABLE "NotificationWorker" (
  "id" TEXT PRIMARY KEY DEFAULT 'push',
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "error" TEXT
);
-- Existing outstanding transfers enter the inbox as well.
INSERT INTO "TransferNotification" ("id", "transferId", "destinationId", "createdAt")
SELECT 'incoming:' || "id", "id", "destinationId", "confirmedAt" FROM "Transfer"
WHERE "approval" IN ('PENDING', 'APPROVED') ON CONFLICT ("transferId") DO NOTHING;

-- Enforce the durable inbox even for older app instances and non-HTTP writers.
CREATE FUNCTION buzz_queue_incoming_transfer() RETURNS trigger AS $$
BEGIN
  INSERT INTO "TransferNotification" ("id", "transferId", "destinationId")
  VALUES ('incoming:' || NEW.id, NEW.id, NEW."destinationId") ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER buzz_queue_incoming_transfer AFTER INSERT ON "Transfer"
  FOR EACH ROW EXECUTE FUNCTION buzz_queue_incoming_transfer();

CREATE FUNCTION buzz_resolve_incoming_transfer() RETURNS trigger AS $$
BEGIN
  IF NEW.approval IN ('REJECTED', 'RECEIVED') THEN
    UPDATE "TransferNotification" SET "closedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    WHERE "transferId" = NEW.id AND "closedAt" IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER buzz_resolve_incoming_transfer AFTER UPDATE OF approval ON "Transfer"
  FOR EACH ROW EXECUTE FUNCTION buzz_resolve_incoming_transfer();
