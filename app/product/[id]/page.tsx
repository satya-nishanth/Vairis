import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPricingConfig, getShowPricesGlobal, toStoneViews, resolvePriceVisibility } from "@/lib/pricing-data";
import { computeCatalogueFromPrice } from "@/lib/product-piece-pricing";
import { prismaToProduct } from "@/lib/prisma-to-product";
import { sortProductsByPriority } from "@/lib/product-priorities";
import { productLabelsFromTags } from "@/lib/category-filters";
import ProductPageClient from "./ProductPageClient";

// Karats always ascend (9K first, so it is the default) whatever order admin saved them in.
const byPurity = <T extends { metalType: string }>(variants: T[]) =>
  [...variants].sort((a, b) => Number.parseInt(a.metalType.replace("GOLD_", ""), 10) - Number.parseInt(b.metalType.replace("GOLD_", ""), 10));

export const revalidate = 120;

type Props = { params: Promise<{ id: string }> };

const productInclude = {
  pieces: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      variants: true,
      stones: { include: { diamondRate: true }, orderBy: { sortOrder: "asc" as const } },
    },
  },
  variants: true,
  stones: { include: { diamondRate: true }, orderBy: { sortOrder: "asc" as const } },
  tags: { select: { group: true, value: true } },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id, isActive: true, status: "LIVE" },
    select: { name: true, description: true, images: true },
  });
  if (!product) return {};
  return {
    title: product.name,
    description: product.description ?? undefined,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.images[0] ? [product.images[0]] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const [product, goldRates, pricingConfig, showPricesGlobal, reviewAgg] = await Promise.all([
    prisma.product.findUnique({
      where: { id, isActive: true, status: "LIVE" },
      include: productInclude,
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
    getShowPricesGlobal(),
    prisma.review.aggregate({
      where: { productId: id, status: "APPROVED" },
      _avg: { rating: true },
      _count: { id: true },
    }),
  ]);

  if (!product) notFound();

  const productLabels = productLabelsFromTags(product.tags);
  const showPrice = resolvePriceVisibility(product.priceVisibility, showPricesGlobal);

  const relatedDbProducts = await prisma.product.findMany({
    where: {
      category: product.category,
      id: { not: product.id },
      isActive: true,
      status: "LIVE",
    },
    orderBy: { name: "asc" },
    include: productInclude,
  });
  const { autoDiscountInfoForProducts } = await import('@/lib/auto-discount-display')
  const relatedSorted = sortProductsByPriority(relatedDbProducts).slice(0, 4)
  const saleMap = await autoDiscountInfoForProducts([product, ...relatedSorted])
  const relatedProducts = relatedSorted.map((p) =>
    prismaToProduct(
      p,
      goldRates,
      pricingConfig,
      showPricesGlobal,
      saleMap.get(p.id)?.percent,
    ),
  )
  const productSale = saleMap.get(product.id) ?? null
  const productSalePercent = productSale?.percent ?? null
  const productSaleDisplayName = productSale?.displayName ?? null

  const fromPrice = computeCatalogueFromPrice(
    product.variants,
    goldRates,
    pricingConfig,
    product.stones,
    product,
    product.pieces,
  );
  const inStock = product.variants.some((v) => v.stock > 0);
  const minPrice = fromPrice?.price ?? 0;
  const productUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://thevairis.com"}/product/${product.id}`;

  const offers =
    !showPrice || minPrice <= 0
      ? undefined
      : {
          "@type": "Offer",
          priceCurrency: "INR",
          price: minPrice,
          availability: inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/PreOrder",
          url: productUrl,
        };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: product.images.filter(Boolean),
    sku: product.itemCode ?? product.id,
    brand: { "@type": "Brand", name: "Vairis" },
    offers,
    ...(reviewAgg._count.id > 0 && reviewAgg._avg.rating != null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Math.round(reviewAgg._avg.rating * 10) / 10,
            reviewCount: reviewAgg._count.id,
          },
        }
      : {}),
  };

  const pieces =
    product.pieces.length > 0
      ? product.pieces.map((p) => ({
          id: p.id,
          name: p.name,
          vaGoldPct: p.vaGoldPct != null ? Number(p.vaGoldPct) : null,
          vaLabel: p.vaLabel,
          stones: toStoneViews(p.stones),
          variants: byPurity(p.variants).map((v) => ({
            id: v.id,
            pieceId: p.id,
            metalType: v.metalType,
            metalColor: v.metalColor,
            sku: v.sku,
            size: v.size,
            weightGrams: v.weightGrams.toString(),
            makingChargePerGram: v.makingChargePerGram.toString(),
            flatMakingCharge: v.flatMakingCharge.toString(),
            stoneCharges: v.stoneCharges.toString(),
            miscCharges: v.miscCharges.toString(),
            certificationCharges:
              v.certificationCharges != null ? v.certificationCharges.toString() : "",
            packagingCharges: v.packagingCharges != null ? v.packagingCharges.toString() : "",
            deliveryCharges: v.deliveryCharges != null ? v.deliveryCharges.toString() : "",
          })),
        }))
      : [
          {
            id: "_default",
            name: "Main",
            vaGoldPct: product.vaGoldPct != null ? Number(product.vaGoldPct) : null,
            vaLabel: product.vaLabel,
            stones: toStoneViews(product.stones),
            variants: byPurity(product.variants).map((v) => ({
              id: v.id,
              pieceId: null as string | null,
              metalType: v.metalType,
              metalColor: v.metalColor,
              sku: v.sku,
              size: v.size,
              weightGrams: v.weightGrams.toString(),
              makingChargePerGram: v.makingChargePerGram.toString(),
              flatMakingCharge: v.flatMakingCharge.toString(),
              stoneCharges: v.stoneCharges.toString(),
              miscCharges: v.miscCharges.toString(),
              certificationCharges:
                v.certificationCharges != null ? v.certificationCharges.toString() : "",
              packagingCharges: v.packagingCharges != null ? v.packagingCharges.toString() : "",
              deliveryCharges: v.deliveryCharges != null ? v.deliveryCharges.toString() : "",
            })),
          },
        ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductPageClient
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          images: product.images.filter(Boolean),
          itemCode: product.itemCode,
          comingSoon: product.comingSoon,
          showPrice,
          labels: productLabels,
          stoneType: product.stoneType ?? null,
          caratWeight: product.caratWeight ? product.caratWeight.toString() : null,
          totalLengthMm: product.totalLengthMm ? product.totalLengthMm.toString() : null,
          motifSizeMm: product.motifSizeMm ? product.motifSizeMm.toString() : null,
          thicknessMm: product.thicknessMm ? product.thicknessMm.toString() : null,
          vaGoldPct: product.vaGoldPct != null ? Number(product.vaGoldPct) : null,
          vaLabel: product.vaLabel,
          pieces,
          autoDiscountPercent: productSalePercent,
          autoDiscountDisplayName: productSaleDisplayName,
        }}
        goldRates={goldRates.map((r) => ({
          metalType: r.metalType,
          ratePerGram: r.ratePerGram.toString(),
        }))}
        pricingConfig={pricingConfig}
        relatedProducts={relatedProducts}
      />
    </>
  );
}
