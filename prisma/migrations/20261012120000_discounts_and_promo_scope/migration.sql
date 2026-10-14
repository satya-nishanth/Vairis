-- AlterTable
ALTER TABLE "Order" ADD COLUMN "discountBreakdown" JSONB;

-- CreateTable
CREATE TABLE "PromoCodeProduct" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "PromoCodeProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCodeCollection" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,

    CONSTRAINT "PromoCodeCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCodeStoreCategory" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "storeCategoryId" TEXT NOT NULL,

    CONSTRAINT "PromoCodeStoreCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCodeCategory" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "category" "Category" NOT NULL,

    CONSTRAINT "PromoCodeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomaticDiscount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "percent" DECIMAL(65,30) NOT NULL,
    "maxDiscount" DECIMAL(65,30),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomaticDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomaticDiscountProduct" (
    "id" TEXT NOT NULL,
    "automaticDiscountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "AutomaticDiscountProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomaticDiscountCollection" (
    "id" TEXT NOT NULL,
    "automaticDiscountId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,

    CONSTRAINT "AutomaticDiscountCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomaticDiscountStoreCategory" (
    "id" TEXT NOT NULL,
    "automaticDiscountId" TEXT NOT NULL,
    "storeCategoryId" TEXT NOT NULL,

    CONSTRAINT "AutomaticDiscountStoreCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomaticDiscountCategory" (
    "id" TEXT NOT NULL,
    "automaticDiscountId" TEXT NOT NULL,
    "category" "Category" NOT NULL,

    CONSTRAINT "AutomaticDiscountCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromoCodeProduct_productId_idx" ON "PromoCodeProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCodeProduct_promoCodeId_productId_key" ON "PromoCodeProduct"("promoCodeId", "productId");

-- CreateIndex
CREATE INDEX "PromoCodeCollection_collectionId_idx" ON "PromoCodeCollection"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCodeCollection_promoCodeId_collectionId_key" ON "PromoCodeCollection"("promoCodeId", "collectionId");

-- CreateIndex
CREATE INDEX "PromoCodeStoreCategory_storeCategoryId_idx" ON "PromoCodeStoreCategory"("storeCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCodeStoreCategory_promoCodeId_storeCategoryId_key" ON "PromoCodeStoreCategory"("promoCodeId", "storeCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCodeCategory_promoCodeId_category_key" ON "PromoCodeCategory"("promoCodeId", "category");

-- CreateIndex
CREATE INDEX "AutomaticDiscountProduct_productId_idx" ON "AutomaticDiscountProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomaticDiscountProduct_automaticDiscountId_productId_key" ON "AutomaticDiscountProduct"("automaticDiscountId", "productId");

-- CreateIndex
CREATE INDEX "AutomaticDiscountCollection_collectionId_idx" ON "AutomaticDiscountCollection"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomaticDiscountCollection_automaticDiscountId_collectionId_key" ON "AutomaticDiscountCollection"("automaticDiscountId", "collectionId");

-- CreateIndex
CREATE INDEX "AutomaticDiscountStoreCategory_storeCategoryId_idx" ON "AutomaticDiscountStoreCategory"("storeCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomaticDiscountStoreCategory_automaticDiscountId_storeCategoryId_key" ON "AutomaticDiscountStoreCategory"("automaticDiscountId", "storeCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomaticDiscountCategory_automaticDiscountId_category_key" ON "AutomaticDiscountCategory"("automaticDiscountId", "category");

-- AddForeignKey
ALTER TABLE "PromoCodeProduct" ADD CONSTRAINT "PromoCodeProduct_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeProduct" ADD CONSTRAINT "PromoCodeProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeCollection" ADD CONSTRAINT "PromoCodeCollection_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeCollection" ADD CONSTRAINT "PromoCodeCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeStoreCategory" ADD CONSTRAINT "PromoCodeStoreCategory_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeStoreCategory" ADD CONSTRAINT "PromoCodeStoreCategory_storeCategoryId_fkey" FOREIGN KEY ("storeCategoryId") REFERENCES "StoreCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeCategory" ADD CONSTRAINT "PromoCodeCategory_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomaticDiscountProduct" ADD CONSTRAINT "AutomaticDiscountProduct_automaticDiscountId_fkey" FOREIGN KEY ("automaticDiscountId") REFERENCES "AutomaticDiscount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomaticDiscountProduct" ADD CONSTRAINT "AutomaticDiscountProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomaticDiscountCollection" ADD CONSTRAINT "AutomaticDiscountCollection_automaticDiscountId_fkey" FOREIGN KEY ("automaticDiscountId") REFERENCES "AutomaticDiscount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomaticDiscountCollection" ADD CONSTRAINT "AutomaticDiscountCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomaticDiscountStoreCategory" ADD CONSTRAINT "AutomaticDiscountStoreCategory_automaticDiscountId_fkey" FOREIGN KEY ("automaticDiscountId") REFERENCES "AutomaticDiscount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomaticDiscountStoreCategory" ADD CONSTRAINT "AutomaticDiscountStoreCategory_storeCategoryId_fkey" FOREIGN KEY ("storeCategoryId") REFERENCES "StoreCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomaticDiscountCategory" ADD CONSTRAINT "AutomaticDiscountCategory_automaticDiscountId_fkey" FOREIGN KEY ("automaticDiscountId") REFERENCES "AutomaticDiscount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
