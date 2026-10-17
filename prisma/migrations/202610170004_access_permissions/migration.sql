ALTER TABLE "User" ADD COLUMN "accessHash" TEXT;
ALTER TABLE "User" ADD COLUMN "menus" TEXT[] NOT NULL DEFAULT ARRAY['dashboard','new-transfer','transfers','products','locations']::TEXT[];
CREATE UNIQUE INDEX "User_accessHash_key" ON "User"("accessHash");
