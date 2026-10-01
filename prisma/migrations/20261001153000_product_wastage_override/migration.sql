-- AlterTable
ALTER TABLE "PricingSettings" ALTER COLUMN "vaLabel" SET DEFAULT 'Value Addition';

UPDATE "PricingSettings" SET "vaLabel" = 'Value Addition' WHERE "id" = 1 AND "vaLabel" = 'Wastage';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "vaGoldPct" DECIMAL(65,30),
ADD COLUMN "vaLabel" TEXT;
