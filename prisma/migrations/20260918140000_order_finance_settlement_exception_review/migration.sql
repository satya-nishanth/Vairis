-- AlterTable
ALTER TABLE "OrderFinance" ADD COLUMN "settlementExceptionReviewedAt" TIMESTAMP(3),
ADD COLUMN "settlementExceptionReviewedBy" TEXT;
