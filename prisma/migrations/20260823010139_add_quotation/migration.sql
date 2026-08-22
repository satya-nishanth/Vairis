-- CreateEnum
CREATE TYPE "QuotationSource" AS ENUM ('MANUAL', 'WEBSITE');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('REQUESTED', 'QUOTED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuotationOrderType" AS ENUM ('VAIRIS', 'CUSTOMISATION');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "quotationId" TEXT;

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "source" "QuotationSource" NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'REQUESTED',
    "orderType" "QuotationOrderType" NOT NULL,
    "details" TEXT,
    "customerName" TEXT,
    "customerMobile" TEXT,
    "productId" TEXT,
    "screenshotUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "discordThreadId" TEXT,
    "lastReminderAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "escalatedAt" TIMESTAMP(3),
    "quotedAmount" INTEGER,
    "quotedNotes" TEXT,
    "quotedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_displayId_key" ON "Quotation"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_orderId_key" ON "Quotation"("orderId");

-- CreateIndex
CREATE INDEX "Quotation_customerMobile_status_idx" ON "Quotation"("customerMobile", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_quotationId_key" ON "Order"("quotationId");
