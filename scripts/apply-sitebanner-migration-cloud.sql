-- Missing on stage/prod cloud DB — causes admin /admin/content SSR crash (P2021).
-- Safe to re-run. Also adds related order-flow columns if still missing.

-- Enums (ignore error if already present)
DO $$ BEGIN
  ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DEPOSIT_REFUNDED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Order deposit fields
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "grandTotal" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "contactName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT NOT NULL DEFAULT '';

-- Payment refund tracking
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "razorpayRefundId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- OrderEvent timeline
CREATE TABLE IF NOT EXISTS "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderEvent_orderId_createdAt_idx"
  ON "OrderEvent"("orderId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- SiteBanner (admin content slots)
CREATE TABLE IF NOT EXISTS "SiteBanner" (
    "id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "linkUrl" TEXT,
    "ctaLabel" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteBanner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SiteBanner_slot_key" ON "SiteBanner"("slot");

-- Unlimited carousel images (for tables created before this column existed)
ALTER TABLE "SiteBanner" ADD COLUMN IF NOT EXISTS "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "SiteBanner"
SET "images" = ARRAY["imageUrl"]
WHERE "imageUrl" IS NOT NULL
  AND "imageUrl" <> ''
  AND cardinality("images") = 0;

-- Category used by stage storefront / admin (harmless if already present)
DO $$ BEGIN
  ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'NECKLACES';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
