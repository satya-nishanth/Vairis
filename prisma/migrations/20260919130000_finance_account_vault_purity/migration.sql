-- Vault gold purity (karat). Used with live 24K rate: grams × rate24k × (purityK / 24).
ALTER TABLE "FinanceAccount" ADD COLUMN "vaultPurityK" DOUBLE PRECISION NOT NULL DEFAULT 24;
