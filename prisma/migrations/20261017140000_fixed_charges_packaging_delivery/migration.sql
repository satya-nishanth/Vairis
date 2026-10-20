-- AlterTable
ALTER TABLE "PricingSettings" ADD COLUMN "defaultCertificationCharges" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "PricingSettings" ADD COLUMN "defaultPackagingCharges" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "PricingSettings" ADD COLUMN "defaultDeliveryCharges" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "packagingCharges" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "ProductVariant" ADD COLUMN "deliveryCharges" DECIMAL(65,30) NOT NULL DEFAULT 0;
