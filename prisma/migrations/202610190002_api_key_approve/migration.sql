-- An administrator may let a key approve transfers it has entered in QBM.
ALTER TABLE "ApiKey" ADD COLUMN "canApprove" BOOLEAN NOT NULL DEFAULT false;
