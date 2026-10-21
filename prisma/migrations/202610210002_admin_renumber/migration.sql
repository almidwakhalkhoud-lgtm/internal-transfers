-- Administrators may change a confirmed transfer's number to match QBM. The
-- application opts in for its own transaction; the saved PDF, which prints
-- the old number, may then be cleared so it is made again. Every other
-- document field stays immutable, and direct SQL changes remain rejected.
CREATE OR REPLACE FUNCTION buzz_guard_transfer_document() RETURNS trigger AS $$
DECLARE
  -- Unset, the setting reads as NULL; coalesce so that means not allowed.
  renumber boolean := coalesce(current_setting('buzz.transfer_renumber', true), '') = 'allowed';
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('buzz.transfer_delete', true) = 'allowed' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Confirmed transfers cannot be deleted';
  END IF;
  IF (NEW."number" IS DISTINCT FROM OLD."number" AND NOT renumber)
     OR ROW(NEW."key",NEW."creatorId",NEW."creatorName",NEW."sourceId",NEW."destinationId",NEW."source",NEW."destination",NEW."date",NEW."remarks",NEW."lines",NEW."total",NEW."confirmedAt",NEW."status")
     IS DISTINCT FROM
     ROW(OLD."key",OLD."creatorId",OLD."creatorName",OLD."sourceId",OLD."destinationId",OLD."source",OLD."destination",OLD."date",OLD."remarks",OLD."lines",OLD."total",OLD."confirmedAt",OLD."status") THEN
    RAISE EXCEPTION 'Confirmed transfer document fields are immutable';
  END IF;
  IF OLD."pdf" IS NOT NULL AND (NEW."pdf" IS DISTINCT FROM OLD."pdf" OR NEW."pdfHash" IS DISTINCT FROM OLD."pdfHash")
     AND NOT (renumber AND NEW."pdf" IS NULL AND NEW."pdfHash" IS NULL) THEN
    RAISE EXCEPTION 'Saved transfer PDF is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
