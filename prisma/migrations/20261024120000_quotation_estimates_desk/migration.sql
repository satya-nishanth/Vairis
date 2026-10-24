-- AlterEnum
ALTER TYPE "QuotationStatus" ADD VALUE 'ACCEPTED';

-- CreateEnum
CREATE TYPE "QuotationEventType" AS ENUM ('CREATED', 'STATUS', 'ESTIMATE', 'COMMENT', 'RESPONSE', 'NOTE');

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN "assigneeEmail" TEXT,
ADD COLUMN "acceptedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Quotation_assigneeEmail_idx" ON "Quotation"("assigneeEmail");

-- CreateTable
CREATE TABLE "QuotationEstimate" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "ratesLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedGoldRate24k" DECIMAL(12,2),
    "payload" JSONB NOT NULL,
    "finalTotal" INTEGER NOT NULL,
    "pngUrl" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationEvent" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "type" "QuotationEventType" NOT NULL,
    "message" TEXT,
    "meta" JSONB,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationComment" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotationEstimate_quotationId_createdAt_idx" ON "QuotationEstimate"("quotationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationEstimate_quotationId_version_key" ON "QuotationEstimate"("quotationId", "version");

-- CreateIndex
CREATE INDEX "QuotationEvent_quotationId_createdAt_idx" ON "QuotationEvent"("quotationId", "createdAt");

-- CreateIndex
CREATE INDEX "QuotationComment_quotationId_createdAt_idx" ON "QuotationComment"("quotationId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuotationEstimate" ADD CONSTRAINT "QuotationEstimate_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationEvent" ADD CONSTRAINT "QuotationEvent_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationComment" ADD CONSTRAINT "QuotationComment_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
