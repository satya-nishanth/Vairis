-- AlterEnum
BEGIN;
CREATE TYPE "MetalType_new" AS ENUM ('GOLD_14K', 'GOLD_18K', 'ROSE_GOLD');
ALTER TABLE "ProductVariant" ALTER COLUMN "metalType" TYPE "MetalType_new" USING ("metalType"::text::"MetalType_new");
ALTER TABLE "GoldRate" ALTER COLUMN "metalType" TYPE "MetalType_new" USING ("metalType"::text::"MetalType_new");
ALTER TYPE "MetalType" RENAME TO "MetalType_old";
ALTER TYPE "MetalType_new" RENAME TO "MetalType";
DROP TYPE "MetalType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_productId_fkey";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "caratWeight" DECIMAL(65,30),
ADD COLUMN     "comingSoon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "designStyle" TEXT,
ADD COLUMN     "gemCount" INTEGER,
ADD COLUMN     "itemCode" TEXT,
ADD COLUMN     "motifSizeMm" DECIMAL(65,30),
ADD COLUMN     "stoneDimMm" TEXT,
ADD COLUMN     "stoneShape" TEXT,
ADD COLUMN     "stoneType" TEXT,
ADD COLUMN     "thicknessMm" DECIMAL(65,30),
ADD COLUMN     "totalLengthMm" DECIMAL(65,30),
ALTER COLUMN "basePrice" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductVariant" ALTER COLUMN "makingChargePerGram" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "SiteBanner" ADD COLUMN     "imageFits" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_userId_productId_key" ON "Wishlist"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_itemCode_key" ON "Product"("itemCode");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

