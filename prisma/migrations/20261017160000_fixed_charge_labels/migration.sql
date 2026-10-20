-- Customer-facing labels for certification / packaging / delivery fees.
ALTER TABLE "PricingSettings" ADD COLUMN "certificationLabel" TEXT NOT NULL DEFAULT 'Certification';
ALTER TABLE "PricingSettings" ADD COLUMN "packagingLabel" TEXT NOT NULL DEFAULT 'Packaging';
ALTER TABLE "PricingSettings" ADD COLUMN "deliveryLabel" TEXT NOT NULL DEFAULT 'Delivery';
