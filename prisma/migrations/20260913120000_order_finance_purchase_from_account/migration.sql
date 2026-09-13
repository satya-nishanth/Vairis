-- Vendor wallet that order-sheet purchase (CP) is attributed to
ALTER TABLE "OrderFinance" ADD COLUMN "purchaseFromAccountId" TEXT;

CREATE INDEX "OrderFinance_purchaseFromAccountId_idx" ON "OrderFinance"("purchaseFromAccountId");

ALTER TABLE "OrderFinance" ADD CONSTRAINT "OrderFinance_purchaseFromAccountId_fkey"
  FOREIGN KEY ("purchaseFromAccountId") REFERENCES "FinanceAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
