-- FinanceTransaction: paidThrough enum → paidThroughAccountId (FinanceAccount FK).
-- Add contactName for free-text / denormalized contact label.

ALTER TABLE "FinanceTransaction" ADD COLUMN "paidThroughAccountId" TEXT;
ALTER TABLE "FinanceTransaction" ADD COLUMN "contactName" TEXT NOT NULL DEFAULT '';

-- Backfill bank used from old enum; PERSONAL → handler account, company → Vairis Bank.
UPDATE "FinanceTransaction"
SET "paidThroughAccountId" = CASE "paidThrough"::text
  WHEN 'VAIRIS_BANK' THEN 'fa_vairis_bank'
  ELSE "accountId"
END;

-- Prefer linked contact name when present.
UPDATE "FinanceTransaction" t
SET "contactName" = c."name"
FROM "FinanceContact" c
WHERE t."contactId" = c."id" AND t."contactName" = '';

ALTER TABLE "FinanceTransaction" ALTER COLUMN "paidThroughAccountId" SET NOT NULL;
ALTER TABLE "FinanceTransaction" DROP COLUMN "paidThrough";

CREATE INDEX "FinanceTransaction_paidThroughAccountId_idx" ON "FinanceTransaction"("paidThroughAccountId");
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_paidThroughAccountId_fkey"
  FOREIGN KEY ("paidThroughAccountId") REFERENCES "FinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
