-- Auto-created payment inflows + admin review flag
ALTER TABLE "FinanceTransaction" ADD COLUMN "autoCreated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FinanceTransaction" ADD COLUMN "reviewComplete" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "FinanceTransaction_autoCreated_reviewComplete_createdAt_idx"
  ON "FinanceTransaction"("autoCreated", "reviewComplete", "createdAt");
