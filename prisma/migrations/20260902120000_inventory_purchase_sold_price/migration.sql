-- Split unitPrice into purchase (cost) and sold (retail) prices.
ALTER TABLE "InventoryItem" ADD COLUMN "purchasePrice" DECIMAL(65,30);
ALTER TABLE "InventoryItem" ADD COLUMN "soldPrice" DECIMAL(65,30);
UPDATE "InventoryItem" SET "soldPrice" = "unitPrice" WHERE "unitPrice" IS NOT NULL;
ALTER TABLE "InventoryItem" DROP COLUMN "unitPrice";
