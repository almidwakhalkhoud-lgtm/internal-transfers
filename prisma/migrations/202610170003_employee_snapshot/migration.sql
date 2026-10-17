ALTER TABLE "Transfer" ADD COLUMN IF NOT EXISTS "creatorName" TEXT NOT NULL DEFAULT '';
UPDATE "Transfer" t SET "creatorName"=u."name" FROM "User" u WHERE t."creatorId"=u."id" AND t."creatorName"='';

CREATE OR REPLACE FUNCTION buzz_guard_transfer_document() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Confirmed transfers cannot be deleted'; END IF;
  IF ROW(NEW."number",NEW."key",NEW."creatorId",NEW."creatorName",NEW."sourceId",NEW."destinationId",NEW."source",NEW."destination",NEW."date",NEW."remarks",NEW."lines",NEW."total",NEW."confirmedAt",NEW."status")
     IS DISTINCT FROM
     ROW(OLD."number",OLD."key",OLD."creatorId",OLD."creatorName",OLD."sourceId",OLD."destinationId",OLD."source",OLD."destination",OLD."date",OLD."remarks",OLD."lines",OLD."total",OLD."confirmedAt",OLD."status") THEN
    RAISE EXCEPTION 'Confirmed transfer document fields are immutable';
  END IF;
  IF OLD."pdf" IS NOT NULL AND (NEW."pdf" IS DISTINCT FROM OLD."pdf" OR NEW."pdfHash" IS DISTINCT FROM OLD."pdfHash") THEN
    RAISE EXCEPTION 'Saved transfer PDF is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='buzz_transfer_employee_snapshot') THEN
  ALTER TABLE "Transfer" ADD CONSTRAINT buzz_transfer_employee_snapshot CHECK (length("creatorName")>0);
 END IF;
END $$;
