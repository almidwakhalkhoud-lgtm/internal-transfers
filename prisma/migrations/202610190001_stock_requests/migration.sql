-- Requests (طلبیه) for items from another location; fulfilling one creates a transfer.
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'FULFILLED', 'CANCELLED', 'DECLINED');

CREATE TABLE "StockRequest" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "lines" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "transferId" TEXT,
    CONSTRAINT "StockRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockRequest_number_key" ON "StockRequest"("number");
CREATE UNIQUE INDEX "StockRequest_transferId_key" ON "StockRequest"("transferId");
CREATE INDEX "StockRequest_status_createdAt_idx" ON "StockRequest"("status", "createdAt");
CREATE INDEX "StockRequest_supplierId_status_idx" ON "StockRequest"("supplierId", "status");
CREATE INDEX "StockRequest_requesterId_status_idx" ON "StockRequest"("requesterId", "status");
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New accounts get the Requests menu; existing ones that can create transfers do too.
ALTER TABLE "User" ALTER COLUMN "menus" SET DEFAULT ARRAY['dashboard','new-transfer','requests','transfers','products','locations']::TEXT[];
UPDATE "User" SET "menus" = array_append("menus", 'requests')
  WHERE 'new-transfer' = ANY("menus") AND NOT 'requests' = ANY("menus");
