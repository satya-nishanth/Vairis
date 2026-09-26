import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaToProduct } from "@/lib/prisma-to-product";
import { getPricingConfig, getShowPricesGlobal } from "@/lib/pricing-data";
import { CollectionPageView } from "./CollectionPageView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await prisma.collection.findUnique({ where: { slug } });
  if (!collection || !collection.active) return {};
  return {
    title: collection.seoTitle ?? collection.title,
    description: collection.seoDescription ?? collection.description ?? undefined,
    openGraph: {
      title: collection.seoTitle ?? collection.title,
      description: collection.seoDescription ?? collection.description ?? undefined,
      images: collection.heroImages[0] ? [collection.heroImages[0]] : [],
    },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const [collection, goldRates, pricingConfig, showPricesGlobal] = await Promise.all([
    prisma.collection.findUnique({
      where: { slug },
      include: {
        products: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: {
              include: {
                variants: true,
                stones: { include: { diamondRate: true }, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
    getShowPricesGlobal(),
  ]);

  if (!collection || !collection.active) notFound();

  const products = collection.products
    .map((cp) => cp.product)
    .filter((p) => p.isActive && p.status === "LIVE")
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.name.localeCompare(b.name))
    .map((p, i) => prismaToProduct(p, goldRates, i, pricingConfig, showPricesGlobal));

  return (
    <CollectionPageView
      collection={{
        slug: collection.slug,
        title: collection.title,
        subtitle: collection.subtitle,
        description: collection.description,
        heroImages: collection.heroImages,
      }}
      products={products}
      emptyState={
        <div className="plp-empty">
          <h2>This edit is being curated</h2>
          <p>New pieces are on their way. Explore our other collections meanwhile.</p>
          <Link href="/all-products/rings" className="btn btn-primary">
            Shop Rings
          </Link>
        </div>
      }
    />
  );
}
