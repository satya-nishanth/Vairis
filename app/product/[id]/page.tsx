import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { calculatePrice } from "@/lib/pricing";
import { getPricingConfig, getShowPricesGlobal, toStoneInputs, toStoneViews, resolvePriceVisibility } from "@/lib/pricing-data";
import { prismaToProduct } from "@/lib/prisma-to-product";
import { sortProductsByPriority } from "@/lib/product-priorities";
import { getAllCategoryFilters, getProductLinkedLabels } from "@/lib/category-filters";
import ProductPageClient from "./ProductPageClient";

export const revalidate = 120;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id, isActive: true, status: 'LIVE' },
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
  const [product, goldRates, pricingConfig, showPricesGlobal, reviewAgg, allFilters] = await Promise.all([
    prisma.product.findUnique({
      where: { id, isActive: true, status: 'LIVE' },
      include: {
        variants: true,
        stones: { include: { diamondRate: true }, orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
    getShowPricesGlobal(),
    prisma.review.aggregate({
      where: { productId: id, status: "APPROVED" },
      _avg: { rating: true },
      _count: { id: true },
    }),
    getAllCategoryFilters(),
  ]);

  if (!product) notFound();

  const productLabels = getProductLinkedLabels(product, allFilters);

  const showPrice = resolvePriceVisibility(product.priceVisibility, showPricesGlobal);

  const relatedDbProducts = await prisma.product.findMany({
    where: {
      category: product.category,
      id: { not: product.id },
      isActive: true,
      status: 'LIVE',
    },
    orderBy: { name: 'asc' },
    include: {
      variants: true,
      stones: { include: { diamondRate: true } },
    },
  });
  const relatedProducts = sortProductsByPriority(relatedDbProducts)
    .slice(0, 4)
    .map((p, i) => prismaToProduct(p, goldRates, i, pricingConfig, showPricesGlobal));

  // JSON-LD Product schema — price from the cheapest variant at current
  // rates (without-exchange), real review aggregates only.
  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]));
  const stoneInputs = toStoneInputs(product.stones);
  const prices = product.variants
    .filter((v) => Number(v.weightGrams) > 0 && rateMap[v.metalType])
    .map((v) =>
      Math.round(
        calculatePrice(
          {
            weightGrams: Number(v.weightGrams),
            makingChargePerGram: Number(v.makingChargePerGram),
            flatMakingCharge: Number(v.flatMakingCharge),
            stoneCharges: Number(v.stoneCharges),
            miscCharges: Number(v.miscCharges),
          },
          rateMap[v.metalType],
          { stones: stoneInputs, withExchange: false, config: pricingConfig },
        ).total,
      ),
    );
  const inStock = product.variants.some((v) => v.stock > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const productUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://thevairis.com"}/product/${product.id}`;

  const offers =
    !showPrice || minPrice <= 0
      ? undefined
      : prices.length > 1 && minPrice !== maxPrice
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "INR",
          lowPrice: minPrice,
          highPrice: maxPrice,
          offerCount: prices.length,
          availability: inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/PreOrder",
          url: productUrl,
        }
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
    sku: product.itemCode ?? product.id,
    image: product.images.filter((s) => s && !/\.(mp4|webm|mov)(\?|$)/i.test(s)),
    brand: { "@type": "Brand", name: "VAIRIS" },
    ...(offers ? { offers } : {}),
    ...(reviewAgg._count.id > 0 && reviewAgg._avg.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Math.round(reviewAgg._avg.rating * 10) / 10,
            reviewCount: reviewAgg._count.id,
          },
        }
      : {}),
  };

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
        stones: toStoneViews(product.stones),
        stoneType: product.stoneType ?? null,
        caratWeight: product.caratWeight ? product.caratWeight.toString() : null,
        variants: product.variants.map((v) => ({
          id: v.id,
          metalType: v.metalType,
          sku: v.sku,
          size: v.size,
          weightGrams: v.weightGrams.toString(),
          makingChargePerGram: v.makingChargePerGram.toString(),
          flatMakingCharge: v.flatMakingCharge.toString(),
          stoneCharges: v.stoneCharges.toString(),
          miscCharges: v.miscCharges.toString(),
        })),
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
