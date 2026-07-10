import type { Metadata } from "next";
import type { Category } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoryPage } from "@/components/commerce/CategoryPage";
import { CATEGORY_LABELS, isShopCategory } from "@/lib/catalogue-ui";
import { prismaToProduct } from "@/lib/prisma-to-product";
import { SLUG_TO_PRISMA } from "@/lib/categories";
import { getBanner } from "@/lib/site-content";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ category: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { category } = await params;
  const meta = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS];
  if (!meta) return {};
  return {
    title: `${meta.title ?? category} | VAIRIS`,
    description: meta.intro ?? "",
  };
}

export default async function AllProductsCategoryPage({ params }: PageProps) {
  const { category } = await params;
  if (!isShopCategory(category)) notFound();

  const prismaCategory = SLUG_TO_PRISMA[category];
  // Always real DB products — categories without DB rows show the empty state,
  // never the wireframe mock catalogue (its slugs 404 on the PDP).
  let prismaProducts: ReturnType<typeof prismaToProduct>[] = [];

  if (prismaCategory) {
    const [dbProducts, goldRates] = await Promise.all([
      prisma.product.findMany({
        where: { category: prismaCategory as Category, isActive: true },
        include: { variants: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.goldRate.findMany(),
    ]);
    prismaProducts = dbProducts.map((p, i) => prismaToProduct(p, goldRates, i));
  }

  // Admin-customizable category hero (slot plp-hero-<category>, /admin/content)
  const heroBanner = await getBanner(`plp-hero-${category}`);

  return (
    <CategoryPage
      category={category}
      prismaProducts={prismaProducts}
      heroImageOverride={heroBanner?.imageUrl ?? undefined}
    />
  );
}
