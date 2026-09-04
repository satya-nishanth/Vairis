-- Manual mark-as-sold with optional order link or free-text reference.
CREATE TABLE "InventorySale" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "orderId" TEXT,
    "unlinkedOrderLabel" TEXT,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventorySale_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventorySale_inventoryItemId_idx" ON "InventorySale"("inventoryItemId");
CREATE INDEX "InventorySale_orderId_idx" ON "InventorySale"("orderId");

ALTER TABLE "InventorySale" ADD CONSTRAINT "InventorySale_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventorySale" ADD CONSTRAINT "InventorySale_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
