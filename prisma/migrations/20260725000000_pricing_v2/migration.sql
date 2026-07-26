-- Pricing v2: product status, diamond rates (with/without exchange),
-- product stones, VA pricing settings, per-item exchange choice.
-- Deposit model retired in app code; depositAmount/grandTotal columns kept
-- for historical orders (grandTotal now equals totalAmount on new orders).

-- Repair MetalType enum for fresh replays (init migration predates GOLD_14K;
-- GOLD_22K / SILVER_925 remain as orphaned labels — Postgres cannot drop them)
ALTER TYPE "MetalType" ADD VALUE IF NOT EXISTS 'GOLD_14K';

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'AI_DRAFT', 'LIVE');

-- AlterTable: Product.status (backfill from isActive)
ALTER TABLE "Product" ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT';
UPDATE "Product" SET "status" = 'LIVE' WHERE "isActive" = true;

-- CreateTable DiamondRate
CREATE TABLE "DiamondRate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ratePerCarat" DECIMAL(65,30) NOT NULL,
    "ratePerCaratExchange" DECIMAL(65,30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiamondRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiamondRate_code_key" ON "DiamondRate"("code");

-- CreateTable ProductStone
CREATE TABLE "ProductStone" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "diamondRateId" TEXT NOT NULL,
    "caratWeight" DECIMAL(65,30) NOT NULL,
    "count" INTEGER,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductStone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductStone_productId_sortOrder_idx" ON "ProductStone"("productId", "sortOrder");
ALTER TABLE "ProductStone" ADD CONSTRAINT "ProductStone_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductStone" ADD CONSTRAINT "ProductStone_diamondRateId_fkey"
    FOREIGN KEY ("diamondRateId") REFERENCES "DiamondRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable PricingSettings (singleton)
CREATE TABLE "PricingSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "vaGoldPct" DECIMAL(65,30) NOT NULL DEFAULT 5,
    "vaStonePct" DECIMAL(65,30) NOT NULL DEFAULT 5,
    "vaLabel" TEXT NOT NULL DEFAULT 'Value Addition',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable: exchange choice per line
ALTER TABLE "CartItem" ADD COLUMN "withExchange" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "withExchange" BOOLEAN NOT NULL DEFAULT false;

-- CartItem unique now includes exchange choice
DROP INDEX "CartItem_userId_variantId_key";
CREATE UNIQUE INDEX "CartItem_userId_variantId_withExchange_key"
    ON "CartItem"("userId", "variantId", "withExchange");

-- Seed: pricing settings singleton + diamond rates (per Anil, 2026-07)
INSERT INTO "PricingSettings" ("id", "updatedAt") VALUES (1, NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "DiamondRate" ("id", "code", "label", "ratePerCarat", "ratePerCaratExchange", "sortOrder", "updatedAt") VALUES
    ('dr_colorless', 'COLORLESS', 'Colourless Diamond', 21000, 30000, 0, NOW()),
    ('dr_special_colored', 'SPECIAL_COLORED', 'Special Coloured Diamond', 31500, 45000, 1, NOW())
ON CONFLICT ("code") DO NOTHING;
