-- Lifecycle v2: status renames + new states, refund ledger, notes,
-- order splitting, shipments 1-per-dispatch.

-- Renames (atomic; existing rows follow automatically)
ALTER TYPE "OrderStatus" RENAME VALUE 'PENDING' TO 'PAYMENT_PENDING';
ALTER TYPE "OrderStatus" RENAME VALUE 'PROCESSING' TO 'PREPARING';

-- New states
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_EXPIRED';
ALTER TYPE "OrderStatus" ADD VALUE 'OUT_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERY_FAILED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURNING_TO_ORIGIN';
ALTER TYPE "OrderStatus" ADD VALUE 'RTO_RECEIVED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURN_REQUESTED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURN_IN_TRANSIT';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURN_RECEIVED';
ALTER TYPE "OrderStatus" ADD VALUE 'SPLIT_INTO_DELIVERIES';
ALTER TYPE "OrderStatus" ADD VALUE 'FAILED_OTHER';

-- Refund ledger enums
CREATE TYPE "RefundKind" AS ENUM ('DEPOSIT', 'FULL', 'PARTIAL');
CREATE TYPE "RefundMethod" AS ENUM ('GATEWAY', 'OFFLINE');
CREATE TYPE "RefundStatus" AS ENUM ('INITIATED', 'COMPLETED');

-- Order: split support
ALTER TABLE "Order" ADD COLUMN "parentOrderId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_parentOrderId_fkey"
  FOREIGN KEY ("parentOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Shipment: one row per dispatch
-- (Shipment_orderId_key was created as a unique INDEX by the init migration, not a table constraint)
DROP INDEX "Shipment_orderId_key";
ALTER TABLE "Shipment" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Shipment" ADD COLUMN "outcome" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "Shipment_orderId_dispatchedAt_idx" ON "Shipment"("orderId", "dispatchedAt");

-- Refund ledger
CREATE TABLE "OrderRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "kind" "RefundKind" NOT NULL,
    "method" "RefundMethod" NOT NULL,
    "gatewayRefundId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'INITIATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderRefund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderRefund_gatewayRefundId_key" ON "OrderRefund"("gatewayRefundId");
CREATE INDEX "OrderRefund_orderId_idx" ON "OrderRefund"("orderId");
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Notes
CREATE TABLE "OrderNote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderNote_orderId_createdAt_idx" ON "OrderNote"("orderId", "createdAt");
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
