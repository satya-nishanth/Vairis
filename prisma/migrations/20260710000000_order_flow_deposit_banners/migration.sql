-- Order flow: 105% deposit model, order timeline events, refund tracking,
-- customizable site banners.

-- AlterEnum: new order status (5% deposit refunded after delivery)
ALTER TYPE "OrderStatus" ADD VALUE 'DEPOSIT_REFUNDED';

-- AlterEnum: partial refund state (deposit refunded, principal kept)
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterTable: Order — deposit model + shipping contact
ALTER TABLE "Order" ADD COLUMN "depositAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "grandTotal" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "contactName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "contactPhone" TEXT NOT NULL DEFAULT '';

-- AlterTable: Payment — refund tracking
ALTER TABLE "Payment" ADD COLUMN "razorpayRefundId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "refundedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateTable: OrderEvent (status timeline)
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: SiteBanner (admin-editable marketing surfaces)
CREATE TABLE "SiteBanner" (
    "id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "ctaLabel" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteBanner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteBanner_slot_key" ON "SiteBanner"("slot");
