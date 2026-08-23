-- FinanceCategory config + optional FK on FinanceTransaction

CREATE TABLE "FinanceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceCategory_name_key" ON "FinanceCategory"("name");

INSERT INTO "FinanceCategory" ("id", "name", "active", "sortOrder", "updatedAt") VALUES
  ('fc_materials', 'Materials', true, 0, NOW()),
  ('fc_making', 'Making / labour', true, 1, NOW()),
  ('fc_logistics', 'Logistics', true, 2, NOW()),
  ('fc_ops', 'Operations', true, 3, NOW()),
  ('fc_marketing', 'Marketing', true, 4, NOW()),
  ('fc_customer', 'Customer payment', true, 5, NOW()),
  ('fc_other', 'Other', true, 6, NOW());

ALTER TABLE "FinanceTransaction" ADD COLUMN "categoryId" TEXT;

CREATE INDEX "FinanceTransaction_categoryId_idx" ON "FinanceTransaction"("categoryId");

ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
