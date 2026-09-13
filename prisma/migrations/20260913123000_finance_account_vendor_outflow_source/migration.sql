-- CreateEnum
CREATE TYPE "VendorOutflowSource" AS ENUM ('ORDER_SHEETS', 'TRANSACTIONS');

-- AlterTable
ALTER TABLE "FinanceAccount" ADD COLUMN "vendorOutflowSource" "VendorOutflowSource" NOT NULL DEFAULT 'ORDER_SHEETS';
