-- Requests being prepared, saved by their author to finish later.
CREATE TABLE "RequestDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RequestDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RequestDraft_userId_idx" ON "RequestDraft"("userId");
