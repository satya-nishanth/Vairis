-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "diamondCarats" DECIMAL(65,30),
ADD COLUMN "stoneCarats" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "InventoryItemPurchaseBill" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "purchaseBillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItemPurchaseBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItemPurchaseBill_purchaseBillId_idx" ON "InventoryItemPurchaseBill"("purchaseBillId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItemPurchaseBill_inventoryItemId_purchaseBillId_key" ON "InventoryItemPurchaseBill"("inventoryItemId", "purchaseBillId");

-- AddForeignKey
ALTER TABLE "InventoryItemPurchaseBill" ADD CONSTRAINT "InventoryItemPurchaseBill_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItemPurchaseBill" ADD CONSTRAINT "InventoryItemPurchaseBill_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
