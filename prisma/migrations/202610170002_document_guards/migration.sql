-- Confirmed document snapshots are immutable. Approval and initial PDF creation remain separate operations.
CREATE OR REPLACE FUNCTION buzz_guard_transfer_document() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Confirmed transfers cannot be deleted';
  END IF;
  IF ROW(NEW."number",NEW."key",NEW."creatorId",NEW."sourceId",NEW."destinationId",NEW."source",NEW."destination",NEW."date",NEW."remarks",NEW."lines",NEW."total",NEW."confirmedAt",NEW."status")
     IS DISTINCT FROM
     ROW(OLD."number",OLD."key",OLD."creatorId",OLD."sourceId",OLD."destinationId",OLD."source",OLD."destination",OLD."date",OLD."remarks",OLD."lines",OLD."total",OLD."confirmedAt",OLD."status") THEN
    RAISE EXCEPTION 'Confirmed transfer document fields are immutable';
  END IF;
  IF OLD."pdf" IS NOT NULL AND (NEW."pdf" IS DISTINCT FROM OLD."pdf" OR NEW."pdfHash" IS DISTINCT FROM OLD."pdfHash") THEN
    RAISE EXCEPTION 'Saved transfer PDF is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS buzz_guard_transfer ON "Transfer";
CREATE TRIGGER buzz_guard_transfer BEFORE UPDATE OR DELETE ON "Transfer" FOR EACH ROW EXECUTE FUNCTION buzz_guard_transfer_document();

CREATE OR REPLACE FUNCTION buzz_guard_audit() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit entries are append only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS buzz_guard_audit_log ON "Audit";
CREATE TRIGGER buzz_guard_audit_log BEFORE UPDATE OR DELETE ON "Audit" FOR EACH ROW EXECUTE FUNCTION buzz_guard_audit();

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='buzz_transfer_positive_total') THEN
    ALTER TABLE "Transfer" ADD CONSTRAINT buzz_transfer_positive_total CHECK ("total" > 0);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='buzz_transfer_distinct_locations') THEN
    ALTER TABLE "Transfer" ADD CONSTRAINT buzz_transfer_distinct_locations CHECK ("sourceId" <> "destinationId");
  END IF;
END $$;
