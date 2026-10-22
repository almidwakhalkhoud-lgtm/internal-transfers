-- Locations a user may only see transfers of, apart from where they work.
CREATE TABLE "_ViewLocations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ViewLocations_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_ViewLocations_B_index" ON "_ViewLocations"("B");
ALTER TABLE "_ViewLocations" ADD CONSTRAINT "_ViewLocations_A_fkey" FOREIGN KEY ("A") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ViewLocations" ADD CONSTRAINT "_ViewLocations_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- An administrator may let a user sign both sides of a transfer.
ALTER TABLE "User" ADD COLUMN "signBothSides" BOOLEAN NOT NULL DEFAULT false;
