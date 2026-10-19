-- Hand-drawn sender and receiver signatures on confirmed transfers.
CREATE TYPE "SignatureSide" AS ENUM ('SOURCE', 'DESTINATION');

CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "side" "SignatureSide" NOT NULL,
    "userId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "image" BYTEA NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Signature_transferId_side_key" ON "Signature"("transferId", "side");
CREATE INDEX "Signature_userId_idx" ON "Signature"("userId");
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transfer" ADD COLUMN "signedPdf" BYTEA, ADD COLUMN "signedPdfFor" TEXT;

-- A signature is never edited. It goes only with its transfer, inside the
-- administrator delete transaction that opts in.
CREATE OR REPLACE FUNCTION buzz_guard_signature() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('buzz.transfer_delete', true) = 'allowed' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Signatures cannot be changed or removed';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER buzz_guard_signature_row BEFORE UPDATE OR DELETE ON "Signature" FOR EACH ROW EXECUTE FUNCTION buzz_guard_signature();

-- Everyone with some menu gets the new Sign menu; who may sign what is
-- decided by location.
ALTER TABLE "User" ALTER COLUMN "menus" SET DEFAULT ARRAY['dashboard', 'new-transfer', 'requests', 'transfers', 'sign', 'products', 'locations']::TEXT[];
UPDATE "User" SET "menus" = array_append("menus", 'sign') WHERE NOT ('sign' = ANY("menus")) AND cardinality("menus") > 0;
