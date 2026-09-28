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
import { getCategoryFilters } from "@/lib/category-filters";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ category: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category } = await params;
  const meta = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS];
  if (meta) {
    return {
      title: meta.title ?? category,
      description: meta.intro ?? "",
    };
  }
  const storeCat = await getStoreCategoryBySlug(category);
  if (storeCat) {
    return {
      title: storeCat.name,
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

  const whereClause: any = {
    isActive: true,
    status: 'LIVE',
  };

  const orConditions: any[] = [];
  const notConditions: any[] = [];

  if (category === "mangalsutra") {
    orConditions.push({ name: { contains: "mangalsutra", mode: "insensitive" } });
  } else if (category === "necklaces") {
    if (prismaCategory) orConditions.push({ category: prismaCategory as Category });
    orConditions.push({ name: { contains: "necklace", mode: "insensitive" } });
  } else if (category === "pendants") {
    if (prismaCategory) orConditions.push({ category: prismaCategory as Category });
    notConditions.push(
      { name: { contains: "mangalsutra", mode: "insensitive" } },
      { name: { contains: "necklace", mode: "insensitive" } },
    );
  } else if (category === "bracelets") {
    if (prismaCategory) orConditions.push({ category: prismaCategory as Category });
    notConditions.push(
      { name: { contains: "earring", mode: "insensitive" } },
      { name: { contains: "stud", mode: "insensitive" } },
      { name: { contains: "cufflink", mode: "insensitive" } },
      { name: { contains: "mangalsutra", mode: "insensitive" } },
    );
  } else if (category === "earrings") {
    if (prismaCategory) orConditions.push({ category: prismaCategory as Category });
    orConditions.push(
      { name: { contains: "earring", mode: "insensitive" } },
      { name: { contains: "stud", mode: "insensitive" } },
    );
    notConditions.push({ name: { contains: "cufflink", mode: "insensitive" } });
  } else if (category === "cufflinks") {
    orConditions.push({ name: { contains: "cufflink", mode: "insensitive" } });
  } else {
    if (prismaCategory) orConditions.push({ category: prismaCategory as Category });
  }

  if (storeCat?.productIds && storeCat.productIds.length > 0) {
    orConditions.push({ id: { in: storeCat.productIds } });
  }

  if (orConditions.length > 0) {
    whereClause.OR = orConditions;
  }
  if (notConditions.length > 0) {
    whereClause.NOT = notConditions;
  }

  if (orConditions.length > 0) {
    try {
      const [dbProducts, goldRates, pricingConfig, showPricesGlobal] = await Promise.all([
        prisma.product.findMany({
          where: whereClause,
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
  const [heroBanner, categoryFilters] = await Promise.all([
    getBanner(`plp-hero-${category}`),
    getCategoryFilters(category).catch(() => null),
  ]);

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
        filterGroups={categoryFilters?.groups}
        labelProductMap={categoryFilters?.labelProductMap}
        labelExcludedMap={categoryFilters?.labelExcludedMap}
      />
    </Suspense>
  );
}
