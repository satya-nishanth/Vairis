-- CreateEnum
CREATE TYPE "PriceVisibility" AS ENUM ('INHERIT', 'SHOW', 'HIDE');

-- AlterTable
ALTER TABLE "PricingSettings" ADD COLUMN     "showPricesGlobal" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "priceVisibility" "PriceVisibility" NOT NULL DEFAULT 'INHERIT';

