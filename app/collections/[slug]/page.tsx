import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaToProduct } from "@/lib/prisma-to-product";
import { getPricingConfig, getShowPricesGlobal } from "@/lib/pricing-data";
import { collectionCollageImages } from "@/components/commerce/CollectionCoverCollage";
import { CollectionPageView } from "./CollectionPageView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await prisma.collection.findUnique({
    where: { slug },
    include: {
      products: {
        where: { product: { isActive: true, status: "LIVE" } },
        orderBy: { sortOrder: "asc" },
        // No take — collage / OG pick first fronts after skipping empty images.
        select: { product: { select: { images: true } } },
      },
    },
  });
  if (!collection || !collection.active) return {};
  const ogImage =
    collection.coverMode === "COLLAGE"
      ? collectionCollageImages(collection.products.map((cp) => cp.product))[0]
      : collection.heroImages[0];
  return {
    title: collection.seoTitle ?? collection.title,
    description: collection.seoDescription ?? collection.description ?? undefined,
    openGraph: {
      title: collection.seoTitle ?? collection.title,
      description: collection.seoDescription ?? collection.description ?? undefined,
      images: ogImage ? [ogImage] : [],
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

  const liveProducts = collection.products
    .map((cp) => cp.product)
    .filter((p) => p.isActive && p.status === "LIVE")
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.name.localeCompare(b.name));
  const { autoDiscountPercentsForProducts } = await import("@/lib/auto-discount-display");
  const saleMap = await autoDiscountPercentsForProducts(liveProducts);
  const products = liveProducts.map((p, i) =>
    prismaToProduct(p, goldRates, i, pricingConfig, showPricesGlobal, saleMap.get(p.id)),
  );

  // Collage follows collection sort order (not PLP priority sort).
  const collageImages = collectionCollageImages(
    collection.products
      .filter((cp) => cp.product.isActive && cp.product.status === "LIVE")
      .map((cp) => cp.product),
  );

  return (
    <CollectionPageView
      collection={{
        slug: collection.slug,
        title: collection.title,
        subtitle: collection.subtitle,
        description: collection.description,
        heroImages: collection.heroImages,
        coverMode: collection.coverMode,
        collageImages,
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
