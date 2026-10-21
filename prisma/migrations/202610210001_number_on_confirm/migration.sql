-- A transfer number is now taken when a transfer is confirmed, not when its
-- draft is first saved, so deleted drafts no longer use numbers up.
ALTER TABLE "Draft" DROP COLUMN "number";

-- Give back the numbers drafts were holding past the last transfer. Never go
-- below the last number an administrator chose in Settings, and never raise.
UPDATE "Sequence" SET "value" = LEAST("value", GREATEST(
  COALESCE((SELECT max((substring("number" from '(\d+)$'))::int) FROM "Transfer"), 0),
  COALESCE((SELECT ("detail"->>'nextValue')::int - 1 FROM "Audit"
            WHERE "action" = 'SETTINGS_UPDATED' AND "detail" ? 'nextValue'
            ORDER BY "createdAt" DESC LIMIT 1), 0)
))
WHERE "id" = 'transfer';
