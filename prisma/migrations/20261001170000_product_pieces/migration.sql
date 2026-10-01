-- CreateTable
CREATE TABLE "ProductPiece" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Main',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "vaGoldPct" DECIMAL(65,30),
    "vaLabel" TEXT,

    CONSTRAINT "ProductPiece_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductPiece_productId_sortOrder_idx" ON "ProductPiece"("productId", "sortOrder");

ALTER TABLE "ProductPiece" ADD CONSTRAINT "ProductPiece_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "pieceId" TEXT;
ALTER TABLE "ProductStone" ADD COLUMN "pieceId" TEXT;

CREATE INDEX "ProductVariant_pieceId_idx" ON "ProductVariant"("pieceId");
CREATE INDEX "ProductStone_pieceId_sortOrder_idx" ON "ProductStone"("pieceId", "sortOrder");

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "ProductPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductStone" ADD CONSTRAINT "ProductStone_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "ProductPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one default piece per product, link existing variants/stones
INSERT INTO "ProductPiece" ("id", "productId", "name", "sortOrder", "vaGoldPct", "vaLabel")
SELECT
  'piece_' || p."id",
  p."id",
  'Main',
  0,
  p."vaGoldPct",
  p."vaLabel"
FROM "Product" p;

UPDATE "ProductVariant" v
SET "pieceId" = 'piece_' || v."productId"
WHERE v."pieceId" IS NULL;

UPDATE "ProductStone" s
SET "pieceId" = 'piece_' || s."productId"
WHERE s."pieceId" IS NULL;
