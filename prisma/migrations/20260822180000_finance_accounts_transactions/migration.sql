-- Finance config (Accounts, Contacts) + Transactions; replace person enums with Account FKs.
-- Keep FinancePaidThrough (VAIRIS_BANK | PERSONAL_FUNDS).

-- CreateEnum
CREATE TYPE "FinanceAccountType" AS ENUM ('PARTNER', 'COMPANY_BANK', 'CASH', 'OTHER');
CREATE TYPE "FinanceContactType" AS ENUM ('CUSTOMER', 'VENDOR', 'OTHER');
CREATE TYPE "FinanceTransactionDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateTable FinanceAccount
CREATE TABLE "FinanceAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "type" "FinanceAccountType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinanceAccount_email_key" ON "FinanceAccount"("email");

-- CreateTable FinanceContact
CREATE TABLE "FinanceContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinanceContactType" NOT NULL DEFAULT 'OTHER',
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceContact_pkey" PRIMARY KEY ("id")
);

-- Seed default accounts (stable ids for backfill)
INSERT INTO "FinanceAccount" ("id", "name", "email", "type", "active", "sortOrder", "updatedAt") VALUES
  ('fa_vairis_bank', 'Vairis Bank', NULL, 'COMPANY_BANK', true, 0, NOW()),
  ('fa_anil', 'Anil', 'anil@thevairis.com', 'PARTNER', true, 1, NOW()),
  ('fa_surya', 'Surya', 'surya@thevairis.com', 'PARTNER', true, 2, NOW()),
  ('fa_vasu', 'Vasu', 'vasu@thevairis.com', 'PARTNER', true, 3, NOW());

-- GeneralExpense: add accountId, backfill from contributor enum, drop contributor
ALTER TABLE "GeneralExpense" ADD COLUMN "accountId" TEXT;

UPDATE "GeneralExpense" SET "accountId" = CASE "contributor"::text
  WHEN 'ANIL' THEN 'fa_anil'
  WHEN 'SURYA' THEN 'fa_surya'
  WHEN 'VASU' THEN 'fa_vasu'
  ELSE NULL
END;

ALTER TABLE "GeneralExpense" DROP COLUMN "contributor";
CREATE INDEX "GeneralExpense_accountId_idx" ON "GeneralExpense"("accountId");
ALTER TABLE "GeneralExpense" ADD CONSTRAINT "GeneralExpense_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OrderFinance: add paidToAccountId, backfill from customerPaidTo, drop customerPaidTo
ALTER TABLE "OrderFinance" ADD COLUMN "paidToAccountId" TEXT;

UPDATE "OrderFinance" SET "paidToAccountId" = CASE "customerPaidTo"::text
  WHEN 'VAIRIS_BANK' THEN 'fa_vairis_bank'
  WHEN 'ANIL' THEN 'fa_anil'
  WHEN 'SURYA' THEN 'fa_surya'
  WHEN 'VASU' THEN 'fa_vasu'
  ELSE 'fa_vairis_bank'
END;

ALTER TABLE "OrderFinance" ALTER COLUMN "paidToAccountId" SET NOT NULL;
ALTER TABLE "OrderFinance" DROP COLUMN "customerPaidTo";
CREATE INDEX "OrderFinance_paidToAccountId_idx" ON "OrderFinance"("paidToAccountId");
ALTER TABLE "OrderFinance" ADD CONSTRAINT "OrderFinance_paidToAccountId_fkey"
  FOREIGN KEY ("paidToAccountId") REFERENCES "FinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old enums
DROP TYPE "FinancePerson";
DROP TYPE "FinancePaidTo";

-- FinanceTransaction
CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "direction" "FinanceTransactionDirection" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "accountId" TEXT NOT NULL,
    "paidThrough" "FinancePaidThrough" NOT NULL,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FinanceTransaction_date_idx" ON "FinanceTransaction"("date");
CREATE INDEX "FinanceTransaction_accountId_idx" ON "FinanceTransaction"("accountId");
CREATE INDEX "FinanceTransaction_contactId_idx" ON "FinanceTransaction"("contactId");
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "FinanceContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FinanceTransactionOrder" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "FinanceTransactionOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinanceTransactionOrder_transactionId_orderId_key"
  ON "FinanceTransactionOrder"("transactionId", "orderId");
CREATE INDEX "FinanceTransactionOrder_orderId_idx" ON "FinanceTransactionOrder"("orderId");
ALTER TABLE "FinanceTransactionOrder" ADD CONSTRAINT "FinanceTransactionOrder_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "FinanceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceTransactionOrder" ADD CONSTRAINT "FinanceTransactionOrder_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
