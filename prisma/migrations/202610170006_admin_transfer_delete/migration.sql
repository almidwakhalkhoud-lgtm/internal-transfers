-- Administrators may delete a confirmed transfer through the application, which
-- opts in for its own transaction and records a full snapshot in the audit log.
-- Direct deletes and all document edits remain rejected.
CREATE OR REPLACE FUNCTION buzz_guard_transfer_document() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('buzz.transfer_delete', true) = 'allowed' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Confirmed transfers cannot be deleted';
  END IF;
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
