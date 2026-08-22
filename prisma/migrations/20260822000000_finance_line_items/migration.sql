-- CreateEnum
CREATE TYPE "FinanceLineKind" AS ENUM ('DELIVERY', 'GOLD', 'STONES', 'DIAMONDS', 'MAKING_CHARGES', 'WASTAGE_CHARGES');

-- CreateTable
CREATE TABLE "OrderFinanceLine" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "kind" "FinanceLineKind" NOT NULL,
    "costPrice" DECIMAL(65,30) NOT NULL,
    "sellingPrice" DECIMAL(65,30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderFinanceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderFinanceLine_sheetId_idx" ON "OrderFinanceLine"("sheetId");

-- AddForeignKey
ALTER TABLE "OrderFinanceLine" ADD CONSTRAINT "OrderFinanceLine_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "OrderFinance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "OrderFinance" DROP COLUMN "goldCost",
DROP COLUMN "diamondCost",
DROP COLUMN "stonesCost",
DROP COLUMN "sellingPrice";
