-- AlterTable: optional per-product diamond ₹/ct overrides (null = store DiamondRate)
ALTER TABLE "ProductStone" ADD COLUMN "ratePerCarat" DECIMAL(65,30),
ADD COLUMN "ratePerCaratExchange" DECIMAL(65,30);
