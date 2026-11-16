-- Administrators may edit a confirmed transfer's items, date and remarks.
-- Each edit raises the revision, keeps the replaced version (with the PDF
-- people downloaded, signatures included) in TransferRevision, and removes
-- the signatures, which approved the old content. The application opts in
-- for its own transaction; direct SQL edits remain rejected.
-- It can run again over a schema made by `prisma db push` (the test runner
-- does that), so every statement tolerates what already exists.
ALTER TABLE "Transfer"
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "editedById" TEXT,
  ADD COLUMN IF NOT EXISTS "editedByName" TEXT;

-- The revision the QBM program entered, so an edit after entry shows.
ALTER TABLE "QbmEntry" ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "TransferRevision" (
  "id" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "remarks" TEXT NOT NULL,
  "lines" JSONB NOT NULL,
  "total" DECIMAL(20,3) NOT NULL,
  "pdf" BYTEA,
  "pdfHash" TEXT,
  "signatures" JSONB NOT NULL,
  "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editedById" TEXT NOT NULL,
  "editedByName" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "TransferRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TransferRevision_transferId_revision_key" ON "TransferRevision"("transferId", "revision");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TransferRevision_transferId_fkey') THEN
    ALTER TABLE "TransferRevision" ADD CONSTRAINT "TransferRevision_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Kept versions never change; they go only with their transfer, inside the
-- administrator delete transaction that opts in.
CREATE OR REPLACE FUNCTION buzz_guard_transfer_revision() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND coalesce(current_setting('buzz.transfer_delete', true), '') = 'allowed' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Transfer revisions cannot be changed or removed';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS buzz_guard_transfer_revision_row ON "TransferRevision";
CREATE TRIGGER buzz_guard_transfer_revision_row BEFORE UPDATE OR DELETE ON "TransferRevision" FOR EACH ROW EXECUTE FUNCTION buzz_guard_transfer_revision();

CREATE OR REPLACE FUNCTION buzz_guard_transfer_document() RETURNS trigger AS $$
DECLARE
  -- Unset, a setting reads as NULL; coalesce so that means not allowed.
  renumber boolean := coalesce(current_setting('buzz.transfer_renumber', true), '') = 'allowed';
  edit boolean := coalesce(current_setting('buzz.transfer_edit', true), '') = 'allowed';
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('buzz.transfer_delete', true) = 'allowed' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Confirmed transfers cannot be deleted';
  END IF;
  IF (NEW."number" IS DISTINCT FROM OLD."number" AND NOT renumber)
     OR ROW(NEW."key",NEW."creatorId",NEW."creatorName",NEW."sourceId",NEW."destinationId",NEW."source",NEW."destination",NEW."confirmedAt",NEW."status")
        IS DISTINCT FROM
        ROW(OLD."key",OLD."creatorId",OLD."creatorName",OLD."sourceId",OLD."destinationId",OLD."source",OLD."destination",OLD."confirmedAt",OLD."status")
     OR (NOT edit AND ROW(NEW."date",NEW."remarks",NEW."lines",NEW."total",NEW."revision",NEW."editedAt",NEW."editedById",NEW."editedByName")
        IS DISTINCT FROM
        ROW(OLD."date",OLD."remarks",OLD."lines",OLD."total",OLD."revision",OLD."editedAt",OLD."editedById",OLD."editedByName"))
     -- An edit moves the revision on by exactly one.
     OR (edit AND NEW."revision" <> OLD."revision" AND NEW."revision" <> OLD."revision" + 1) THEN
    RAISE EXCEPTION 'Confirmed transfer document fields are immutable';
  END IF;
  IF OLD."pdf" IS NOT NULL AND (NEW."pdf" IS DISTINCT FROM OLD."pdf" OR NEW."pdfHash" IS DISTINCT FROM OLD."pdfHash")
     AND NOT ((renumber OR edit) AND NEW."pdf" IS NULL AND NEW."pdfHash" IS NULL) THEN
    RAISE EXCEPTION 'Saved transfer PDF is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- An edit removes the signatures of the replaced content (kept in its
-- revision and its PDF); otherwise a signature is never changed.
CREATE OR REPLACE FUNCTION buzz_guard_signature() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND (
    coalesce(current_setting('buzz.transfer_delete', true), '') = 'allowed'
    OR coalesce(current_setting('buzz.transfer_edit', true), '') = 'allowed'
  ) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Signatures cannot be changed or removed';
END;
$$ LANGUAGE plpgsql;
