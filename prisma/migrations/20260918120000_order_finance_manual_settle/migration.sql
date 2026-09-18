-- AlterTable
ALTER TABLE "OrderFinance" ADD COLUMN "manuallySettledAt" TIMESTAMP(3),
ADD COLUMN "manuallySettledNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN "manuallySettledBy" TEXT;
