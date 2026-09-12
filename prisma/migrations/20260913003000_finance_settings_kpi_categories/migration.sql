-- Finance dashboard KPI category filters (singleton id=1)
CREATE TABLE "FinanceSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cashInflowCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generalExpenseCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "FinanceSettings" ("id", "cashInflowCategoryIds", "generalExpenseCategoryIds", "updatedAt")
VALUES (1, ARRAY[]::TEXT[], ARRAY[]::TEXT[], NOW());
