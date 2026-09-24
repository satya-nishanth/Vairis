import type { Metadata } from "next";
import { Suspense } from "react";
import type { Category } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoryPage } from "@/components/commerce/CategoryPage";
import { CATEGORY_LABELS, isShopCategory } from "@/lib/catalogue-ui";
import { prismaToProduct } from "@/lib/prisma-to-product";
import { getPricingConfig, getShowPricesGlobal } from "@/lib/pricing-data";
import { SLUG_TO_PRISMA } from "@/lib/categories";
import { getBanner } from "@/lib/site-content";
import { getStoreCategoryBySlug } from "@/lib/store-categories";
import { sortProductsByPriority } from "@/lib/product-priorities";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ category: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category } = await params;
  const meta = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS];
  if (meta) {
    return {
      title: `${meta.title ?? category} | VAIRIS`,
      description: meta.intro ?? "",
    };
  }
  const storeCat = await getStoreCategoryBySlug(category);
  if (storeCat) {
    return {
      title: `${storeCat.name} | VAIRIS`,
      description: storeCat.description ?? "",
    };
  }
  return {};
}

export default async function AllProductsCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const isBuiltIn = isShopCategory(category);
  const storeCat = await getStoreCategoryBySlug(category);

  if (!isBuiltIn && !storeCat) notFound();

  const prismaCategory = SLUG_TO_PRISMA[category];
  // Always real DB products — categories without DB rows show the empty state,
  // never the wireframe mock catalogue (its slugs 404 on the PDP).
  let prismaProducts: ReturnType<typeof prismaToProduct>[] = [];

  const whereConditions: any[] = [];
  if (prismaCategory) {
    whereConditions.push({ category: prismaCategory as Category });
  }
  if (storeCat?.productIds && storeCat.productIds.length > 0) {
    whereConditions.push({ id: { in: storeCat.productIds } });
  }

  if (whereConditions.length > 0) {
    try {
      const [dbProducts, goldRates, pricingConfig, showPricesGlobal] = await Promise.all([
        prisma.product.findMany({
          where: {
            OR: whereConditions,
            isActive: true,
            status: 'LIVE',
          },
          include: {
            variants: true,
            stones: { include: { diamondRate: true }, orderBy: { sortOrder: "asc" } },
          },
          orderBy: { name: "asc" },
        }),
        prisma.goldRate.findMany(),
        getPricingConfig(),
        getShowPricesGlobal(),
      ]);
      const sortedDbProducts = sortProductsByPriority(dbProducts);
      prismaProducts = sortedDbProducts.map((p, i) => prismaToProduct(p, goldRates, i, pricingConfig, showPricesGlobal));
    } catch (err) {
      // e.g. Category enum value missing on DB (NECKLACES migration not applied)
      console.error(`[plp] failed loading category=${category}`, err);
      prismaProducts = [];
    }
  }

  // Admin-customizable category hero (slot plp-hero-<category>, /admin/content)
  // title -> story line 1, subtitle -> story line 2, ctaLabel -> intro, images[] -> carousel
  const heroBanner = await getBanner(`plp-hero-${category}`);
  const storyOverride =
    heroBanner?.title?.trim()
      ? {
          line1: heroBanner.title.trim(),
          line2: (heroBanner.subtitle ?? "").trim(),
        }
      : null;

  return (
    <Suspense fallback={null}>
      <CategoryPage
        category={category}
        categoryTitle={storeCat?.name}
        categoryIntro={storeCat?.description ?? undefined}
        prismaProducts={prismaProducts}
        heroImagesOverride={
          heroBanner?.images?.length ? heroBanner.images : (storeCat?.image ? [storeCat.image] : undefined)
        }
        heroImageFits={
          heroBanner?.images?.length ? heroBanner.imageFits : undefined
        }
        storyOverride={storyOverride}
        introOverride={heroBanner?.ctaLabel ?? undefined}
      />
    </Suspense>
  );
}
