-- Separate FinanceCategory by inflow vs outflow
ALTER TABLE "FinanceCategory" ADD COLUMN "direction" "FinanceTransactionDirection" NOT NULL DEFAULT 'OUTFLOW';

UPDATE "FinanceCategory" SET "direction" = 'INFLOW' WHERE "id" = 'fc_customer';

DROP INDEX IF EXISTS "FinanceCategory_name_key";

INSERT INTO "FinanceCategory" ("id", "name", "direction", "active", "sortOrder", "updatedAt")
VALUES ('fc_other_in', 'Other', 'INFLOW', true, 1, NOW());

CREATE UNIQUE INDEX "FinanceCategory_name_direction_key" ON "FinanceCategory"("name", "direction");

CREATE INDEX "FinanceCategory_direction_active_idx" ON "FinanceCategory"("direction", "active");
