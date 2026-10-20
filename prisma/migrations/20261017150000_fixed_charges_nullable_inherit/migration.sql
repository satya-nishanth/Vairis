-- Null = inherit PricingSettings defaults. Existing zeros (never customized) become inherit.
ALTER TABLE "ProductVariant" ALTER COLUMN "certificationCharges" DROP NOT NULL;
ALTER TABLE "ProductVariant" ALTER COLUMN "packagingCharges" DROP NOT NULL;
ALTER TABLE "ProductVariant" ALTER COLUMN "deliveryCharges" DROP NOT NULL;

ALTER TABLE "ProductVariant" ALTER COLUMN "certificationCharges" DROP DEFAULT;
ALTER TABLE "ProductVariant" ALTER COLUMN "packagingCharges" DROP DEFAULT;
ALTER TABLE "ProductVariant" ALTER COLUMN "deliveryCharges" DROP DEFAULT;

UPDATE "ProductVariant" SET "certificationCharges" = NULL WHERE "certificationCharges" = 0;
UPDATE "ProductVariant" SET "packagingCharges" = NULL WHERE "packagingCharges" = 0;
UPDATE "ProductVariant" SET "deliveryCharges" = NULL WHERE "deliveryCharges" = 0;
