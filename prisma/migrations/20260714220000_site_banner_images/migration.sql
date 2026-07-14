-- Unlimited hero images per SiteBanner slot (category / home carousels).
ALTER TABLE "SiteBanner" ADD COLUMN IF NOT EXISTS "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill from legacy single imageUrl
UPDATE "SiteBanner"
SET "images" = ARRAY["imageUrl"]
WHERE "imageUrl" IS NOT NULL
  AND "imageUrl" <> ''
  AND cardinality("images") = 0;
