import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoryPage } from "@/components/commerce/CategoryPage";
import {
  CATEGORY_LABELS,
  SHOP_CATEGORIES,
  isShopCategory,
} from "@/lib/catalogue-ui";
import { prismaToProduct } from "@/lib/prisma-to-product";

export const dynamic = "force-dynamic";

const CATALOGUE_TO_PRISMA: Record<string, string> = {
  rings: "RINGS",
  earrings: "EARRINGS",
  pendants: "PENDANTS",
  bracelets: "BRACELETS",
  necklaces: "NECKLACES",
};

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

  const prismaCategory = CATALOGUE_TO_PRISMA[category];
  let prismaProducts: ReturnType<typeof prismaToProduct>[] | undefined;

  if (prismaCategory) {
    const [dbProducts, goldRates] = await Promise.all([
      prisma.product.findMany({
        where: { category: prismaCategory as any, isActive: true },
        include: { variants: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.goldRate.findMany(),
    ]);
    const mapped = dbProducts.map((p, i) => prismaToProduct(p, goldRates, i));
    if (mapped.length > 0) prismaProducts = mapped;
  }

  return (
    <CategoryPage
      category={category}
      prismaProducts={prismaProducts}
    />
  );
}
