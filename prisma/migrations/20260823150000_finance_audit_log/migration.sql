-- Finance section mutation audit trail
CREATE TABLE "FinanceAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorEmail" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,

    CONSTRAINT "FinanceAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceAuditLog_createdAt_idx" ON "FinanceAuditLog"("createdAt");
CREATE INDEX "FinanceAuditLog_entityType_createdAt_idx" ON "FinanceAuditLog"("entityType", "createdAt");
CREATE INDEX "FinanceAuditLog_actorEmail_createdAt_idx" ON "FinanceAuditLog"("actorEmail", "createdAt");
