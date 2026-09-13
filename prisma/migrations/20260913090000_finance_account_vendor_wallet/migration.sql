-- Tag finance accounts as vendor wallets (dashboard By account subsection)
ALTER TABLE "FinanceAccount" ADD COLUMN "isVendorWallet" BOOLEAN NOT NULL DEFAULT false;
