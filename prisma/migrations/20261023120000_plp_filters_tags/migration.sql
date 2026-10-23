-- PLP redesign: Type/Occasion filter tags + per-category option lists (replaces data/category-filters.json)

-- CreateEnum
CREATE TYPE "ProductTagGroup" AS ENUM ('TYPE', 'OCCASION');

-- CreateTable
CREATE TABLE "ProductTag" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "group" "ProductTagGroup" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryFilterConfig" (
    "categorySlug" TEXT NOT NULL,
    "categoryName" TEXT,
    "types" TEXT[],
    "occasions" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryFilterConfig_pkey" PRIMARY KEY ("categorySlug")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductTag_productId_group_value_key" ON "ProductTag"("productId", "group", "value");

-- CreateIndex
CREATE INDEX "ProductTag_group_value_idx" ON "ProductTag"("group", "value");

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed option lists (from the former PLP_FILTER_GROUPS)
INSERT INTO "CategoryFilterConfig" ("categorySlug", "categoryName", "types", "occasions", "updatedAt") VALUES
  ('rings', 'Rings', ARRAY['Solitaire','Stackable','Band'], ARRAY['Everyday','Office','Gifting'], CURRENT_TIMESTAMP),
  ('necklaces', 'Necklaces', ARRAY['Solitaire','Layering','Minimal'], ARRAY['Everyday','Office'], CURRENT_TIMESTAMP),
  ('earrings', 'Earrings', ARRAY['Studs','Drops','Hoops'], ARRAY['Everyday','Office'], CURRENT_TIMESTAMP),
  ('bracelets', 'Bracelets', ARRAY['Tennis','Chain','Layering','Minimal'], ARRAY[]::TEXT[], CURRENT_TIMESTAMP),
  ('pendants', 'Pendants', ARRAY['Solitaire','Minimal'], ARRAY['Everyday','Gifting'], CURRENT_TIMESTAMP),
  ('mangalsutra', 'Mangalsutra', ARRAY['Modern','Traditional','Solitaire','Minimal'], ARRAY['Everyday'], CURRENT_TIMESTAMP),
  ('cufflinks', 'Cufflinks', ARRAY['Classic','Modern'], ARRAY['Gifting'], CURRENT_TIMESTAMP),
  ('sets', 'Sets', ARRAY['Necklace & Earrings','Bridal'], ARRAY['Gifting'], CURRENT_TIMESTAMP),
  ('nose-pins', 'Nose pins', ARRAY['Stud','Minimal'], ARRAY['Everyday'], CURRENT_TIMESTAMP);

-- Seed product tags with the keyword match the storefront used (name / style / description;
-- occasions match name / style only, since descriptions say "everyday" almost everywhere)
INSERT INTO "ProductTag" ("id", "productId", "group", "value")
SELECT 'seed_' || md5(p."id" || t.g || t.v), p."id", t.g::"ProductTagGroup", t.v
FROM "Product" p
JOIN (VALUES
  ('rings', 'TYPE', 'Solitaire', 'solitaire'),
  ('rings', 'TYPE', 'Stackable', 'stackable'),
  ('rings', 'TYPE', 'Band', 'band'),
  ('rings', 'OCCASION', 'Everyday', 'everyday'),
  ('rings', 'OCCASION', 'Office', 'office'),
  ('rings', 'OCCASION', 'Gifting', 'gift'),
  ('necklaces', 'TYPE', 'Solitaire', 'solitaire'),
  ('necklaces', 'TYPE', 'Layering', 'layer'),
  ('necklaces', 'TYPE', 'Minimal', 'minimal'),
  ('necklaces', 'OCCASION', 'Everyday', 'everyday'),
  ('necklaces', 'OCCASION', 'Office', 'office'),
  ('earrings', 'TYPE', 'Studs', 'stud'),
  ('earrings', 'TYPE', 'Drops', 'drop'),
  ('earrings', 'TYPE', 'Hoops', 'hoop'),
  ('earrings', 'OCCASION', 'Everyday', 'everyday'),
  ('earrings', 'OCCASION', 'Office', 'office'),
  ('bracelets', 'TYPE', 'Tennis', 'tennis'),
  ('bracelets', 'TYPE', 'Chain', 'chain'),
  ('bracelets', 'TYPE', 'Layering', 'layer'),
  ('bracelets', 'TYPE', 'Minimal', 'minimal'),
  ('pendants', 'TYPE', 'Solitaire', 'solitaire'),
  ('pendants', 'TYPE', 'Minimal', 'minimal'),
  ('pendants', 'OCCASION', 'Everyday', 'everyday'),
  ('pendants', 'OCCASION', 'Gifting', 'gift')
) AS t(slug, g, v, kw) ON lower(p."category"::text) = t.slug
WHERE lower(CASE WHEN t.g = 'OCCASION' THEN concat_ws(' ', p."name", p."designStyle")
                 ELSE concat_ws(' ', p."name", p."designStyle", p."description") END) LIKE '%' || t.kw || '%'
ON CONFLICT DO NOTHING;

-- Products the old JSON explicitly excluded from every label (staging data)
DELETE FROM "ProductTag" WHERE "productId" IN ('cmuph1j3s000o6o9dy4wmnczn', 'cmpqkpcmx0034uori6t3imt2t');
