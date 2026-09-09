-- CreateTable
CREATE TABLE "InventoryAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorEmail" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "objectLabel" TEXT NOT NULL DEFAULT '',
    "objectHref" TEXT,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,

    CONSTRAINT "InventoryAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryAuditLog_createdAt_idx" ON "InventoryAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryAuditLog_entityType_createdAt_idx" ON "InventoryAuditLog"("entityType", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryAuditLog_actorEmail_createdAt_idx" ON "InventoryAuditLog"("actorEmail", "createdAt");
