-- Administrators may remove one signature of a transfer (a wrong signer, a
-- spoiled drawing) so that side is signed again. The application opts in
-- for its own transaction and records who signed and when in the audit log;
-- direct deletes and any change to a signature stay rejected.
-- It can run again over a schema made by `prisma db push` (the test runner
-- does that), so it replaces the function and the trigger.
CREATE OR REPLACE FUNCTION buzz_guard_signature() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND (
    coalesce(current_setting('buzz.transfer_delete', true), '') = 'allowed'
    OR coalesce(current_setting('buzz.transfer_edit', true), '') = 'allowed'
    OR coalesce(current_setting('buzz.signature_remove', true), '') = 'allowed'
  ) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Signatures cannot be changed or removed';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS buzz_guard_signature_row ON "Signature";
CREATE TRIGGER buzz_guard_signature_row BEFORE UPDATE OR DELETE ON "Signature" FOR EACH ROW EXECUTE FUNCTION buzz_guard_signature();
