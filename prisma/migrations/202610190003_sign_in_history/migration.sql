-- Signing moved into Transfer history, so the separate Sign menu is gone.
ALTER TABLE "User" ALTER COLUMN "menus" SET DEFAULT ARRAY['dashboard', 'new-transfer', 'requests', 'transfers', 'products', 'locations']::TEXT[];
UPDATE "User" SET "menus" = array_remove("menus", 'sign') WHERE 'sign' = ANY("menus");
