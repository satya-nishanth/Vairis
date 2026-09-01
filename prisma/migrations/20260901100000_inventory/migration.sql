-- Inventory holders, stock lines, and manual-order allocations.

CREATE TABLE "InventoryHolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryHolder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "customName" TEXT,
    "customDescription" TEXT,
    "metalPurity" TEXT,
    "weightGrams" DECIMAL(65,30),
    "qtyOnHand" INTEGER NOT NULL DEFAULT 0,
    "holderId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryAllocation" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "qty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryHolder_active_sortOrder_idx" ON "InventoryHolder"("active", "sortOrder");

CREATE INDEX "InventoryItem_holderId_idx" ON "InventoryItem"("holderId");
CREATE INDEX "InventoryItem_productId_idx" ON "InventoryItem"("productId");
CREATE INDEX "InventoryItem_variantId_idx" ON "InventoryItem"("variantId");
CREATE INDEX "InventoryItem_qtyOnHand_idx" ON "InventoryItem"("qtyOnHand");

CREATE INDEX "InventoryAllocation_inventoryItemId_idx" ON "InventoryAllocation"("inventoryItemId");
CREATE INDEX "InventoryAllocation_orderId_idx" ON "InventoryAllocation"("orderId");
CREATE INDEX "InventoryAllocation_orderItemId_idx" ON "InventoryAllocation"("orderItemId");

ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "InventoryHolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryAllocation" ADD CONSTRAINT "InventoryAllocation_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryAllocation" ADD CONSTRAINT "InventoryAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAllocation" ADD CONSTRAINT "InventoryAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "InventoryHolder" ("id", "name", "active", "sortOrder", "createdAt", "updatedAt") VALUES
  ('inv_holder_workshop', 'Workshop', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('inv_holder_store', 'Store — Mumbai', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('inv_holder_founder', 'Founder — Anil', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
