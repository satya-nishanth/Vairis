-- Split metal purity (MetalType) from alloy color (MetalColor).
-- Legacy ROSE_GOLD → GOLD_18K + ROSE.

-- 1. Color enum + column
CREATE TYPE "MetalColor" AS ENUM ('YELLOW', 'WHITE', 'ROSE');

ALTER TABLE "ProductVariant"
  ADD COLUMN "metalColor" "MetalColor" NOT NULL DEFAULT 'YELLOW';

-- 2. Map rose variants before dropping ROSE_GOLD from MetalType
UPDATE "ProductVariant"
SET "metalColor" = 'ROSE',
    "metalType" = 'GOLD_18K'
WHERE "metalType"::text = 'ROSE_GOLD';

DELETE FROM "GoldRate" WHERE "metalType"::text = 'ROSE_GOLD';

-- 3. Replace MetalType enum (purity only)
CREATE TYPE "MetalType_new" AS ENUM ('GOLD_9K', 'GOLD_14K', 'GOLD_18K', 'GOLD_22K');

ALTER TABLE "ProductVariant"
  ALTER COLUMN "metalType" TYPE "MetalType_new"
  USING (
    CASE "metalType"::text
      WHEN 'GOLD_14K' THEN 'GOLD_14K'::"MetalType_new"
      WHEN 'GOLD_9K' THEN 'GOLD_9K'::"MetalType_new"
      WHEN 'GOLD_22K' THEN 'GOLD_22K'::"MetalType_new"
      ELSE 'GOLD_18K'::"MetalType_new"
    END
  );

ALTER TABLE "GoldRate"
  ALTER COLUMN "metalType" TYPE "MetalType_new"
  USING (
    CASE "metalType"::text
      WHEN 'GOLD_14K' THEN 'GOLD_14K'::"MetalType_new"
      WHEN 'GOLD_9K' THEN 'GOLD_9K'::"MetalType_new"
      WHEN 'GOLD_22K' THEN 'GOLD_22K'::"MetalType_new"
      ELSE 'GOLD_18K'::"MetalType_new"
    END
  );

DROP TYPE "MetalType";
ALTER TYPE "MetalType_new" RENAME TO "MetalType";

-- 4. Seed 22K / 9K rates from 18K when present
INSERT INTO "GoldRate" ("metalType", "ratePerGram", "fetchedAt")
SELECT 'GOLD_22K'::"MetalType", ROUND(("ratePerGram"::numeric) * 22 / 18, 4), NOW()
FROM "GoldRate" WHERE "metalType" = 'GOLD_18K'
ON CONFLICT ("metalType") DO NOTHING;

INSERT INTO "GoldRate" ("metalType", "ratePerGram", "fetchedAt")
SELECT 'GOLD_9K'::"MetalType", ROUND(("ratePerGram"::numeric) * 9 / 18, 4), NOW()
FROM "GoldRate" WHERE "metalType" = 'GOLD_18K'
ON CONFLICT ("metalType") DO NOTHING;

-- 5. Index for variant lookup by purity + color
CREATE INDEX "ProductVariant_productId_metalType_metalColor_idx"
  ON "ProductVariant"("productId", "metalType", "metalColor");
