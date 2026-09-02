-- CreateEnum
CREATE TYPE "FinancePaidThrough" AS ENUM ('VAIRIS_BANK', 'PERSONAL_FUNDS');

-- CreateEnum
CREATE TYPE "FinancePerson" AS ENUM ('ANIL', 'SURYA', 'VASU');

-- CreateEnum
CREATE TYPE "FinancePaidTo" AS ENUM ('VAIRIS_BANK', 'ANIL', 'SURYA', 'VASU');

-- CreateTable
CREATE TABLE "GeneralExpense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paidThrough" "FinancePaidThrough" NOT NULL,
    "contributor" "FinancePerson",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneralExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderFinance" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "goldCost" DECIMAL(65,30) NOT NULL,
    "diamondCost" DECIMAL(65,30) NOT NULL,
    "stonesCost" DECIMAL(65,30) NOT NULL,
    "sellingPrice" DECIMAL(65,30) NOT NULL,
    "customerPaidTo" "FinancePaidTo" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderFinance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneralExpense_date_idx" ON "GeneralExpense"("date");

-- CreateIndex
CREATE UNIQUE INDEX "OrderFinance_orderId_key" ON "OrderFinance"("orderId");

-- CreateIndex
CREATE INDEX "OrderFinance_createdAt_idx" ON "OrderFinance"("createdAt");

-- AddForeignKey
ALTER TABLE "OrderFinance" ADD CONSTRAINT "OrderFinance_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
