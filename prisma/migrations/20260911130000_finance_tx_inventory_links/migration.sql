-- AlterTable
ALTER TABLE "FinanceTransaction" ADD COLUMN "unlinkedInventoryLabels" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "FinanceTransactionInventory" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,

    CONSTRAINT "FinanceTransactionInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceTransactionInventory_transactionId_inventoryItemId_key" ON "FinanceTransactionInventory"("transactionId", "inventoryItemId");
CREATE INDEX "FinanceTransactionInventory_inventoryItemId_idx" ON "FinanceTransactionInventory"("inventoryItemId");

ALTER TABLE "FinanceTransactionInventory" ADD CONSTRAINT "FinanceTransactionInventory_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinanceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceTransactionInventory" ADD CONSTRAINT "FinanceTransactionInventory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
