-- AlterEnum
ALTER TYPE "FinanceTransactionDirection" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "FinanceTransaction" ADD COLUMN "transferToAccountId" TEXT;

-- CreateIndex
CREATE INDEX "FinanceTransaction_transferToAccountId_idx" ON "FinanceTransaction"("transferToAccountId");

-- AddForeignKey
ALTER TABLE "FinanceTransaction"
  ADD CONSTRAINT "FinanceTransaction_transferToAccountId_fkey"
  FOREIGN KEY ("transferToAccountId") REFERENCES "FinanceAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
