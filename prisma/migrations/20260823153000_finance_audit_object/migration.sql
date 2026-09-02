-- Human-readable object label + optional deep link on audit rows
ALTER TABLE "FinanceAuditLog" ADD COLUMN "objectLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FinanceAuditLog" ADD COLUMN "objectHref" TEXT;
