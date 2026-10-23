import type { Product as PrismaProduct, ProductVariant, GoldRate } from "@prisma/client";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/lib/pricing";
import { resolvePriceVisibility, type StoneWithRate } from "@/lib/pricing-data";
import { computeCatalogueFromPrice } from "@/lib/product-piece-pricing";
import { prismaCategoryToSlug } from "@/lib/categories";
import type { Product } from "@/lib/ui-data";
import type { ProductCategory } from "@/lib/catalogue-ui";
import {
  normalizeProductImages,
  productFrontImage,
  productHoverImage,
} from "@/lib/product-media";
import { metalFilterLabels } from "@/lib/metal";

type PieceRow = {
  id: string;
  name: string;
  vaGoldPct?: number | string | { toString(): string } | null;
  vaLabel?: string | null;
};

type PrismaProductWithVariants = PrismaProduct & {
  variants: ProductVariant[];
  stones?: StoneWithRate[];
  pieces?: PieceRow[];
};

export function formatDisplayName(
  rawName: string | null | undefined,
  category: string,
  designStyle?: string | null
): string {
  const name = (rawName ?? "").trim();
  const cleanCat = category.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (!name) {
    return designStyle ? `${designStyle.trim()} ${cleanCat}` : `Signature ${cleanCat}`;
  }

  const isRawSku =
    !/[a-z]/.test(name) &&
    /\d/.test(name) &&
    (/^[A-Z0-9_\-\s]{6,}$/.test(name) || name.includes("_") || /^[A-Z]{2,}\d+/.test(name));

  if (isRawSku) {
    if (designStyle && designStyle.trim()) {
      return `${designStyle.trim()} ${cleanCat}`;
    }
    return `Signature ${cleanCat}`;
  }

  return name;
}

export function prismaToProduct(
  p: PrismaProductWithVariants,
  goldRates: GoldRate[],
  index = 0,
  pricingConfig: PricingConfig = DEFAULT_PRICING_CONFIG,
  showPricesGlobal = true,
  autoDiscountPercent?: number | null,
): Product {
  const priceHidden = !resolvePriceVisibility(p.priceVisibility, showPricesGlobal);
  let price: number | undefined;
  let variantId: string | undefined;
  let hasMultiplePrices = false;
  if (!priceHidden && !p.comingSoon && p.variants.length > 0 && goldRates.length > 0) {
    const from = computeCatalogueFromPrice(
      p.variants,
      goldRates,
      pricingConfig,
      p.stones ?? [],
      p,
      p.pieces ?? null,
    );
    if (from) {
      price = from.price;
      variantId = from.variantId;
      hasMultiplePrices = from.hasMultiplePrices;
    } else if (Number(p.basePrice) > 0) {
      price = Math.round(Number(p.basePrice));
      if (p.variants.length > 0) {
        variantId = p.variants[0].id;
      }
    }
  }

  const category: ProductCategory = prismaCategoryToSlug(p.category);

  const layout = normalizeProductImages(p.images ?? []);
  const images = layout.filter(Boolean);
  const primaryImage = productFrontImage(layout);
  const hoverImage = productHoverImage(layout);

  const variants = p.variants ?? [];
  const metals = [
    ...new Set(
      variants.flatMap((v) =>
        metalFilterLabels(v.metalType, v.metalColor ?? "YELLOW"),
      ),
    ),
  ];
  const styleText = [p.designStyle ?? "", p.description ?? "", p.name].join(" ").toLowerCase();
  const inStock = variants.some((v) => v.stock > 0);

  return {
    slug: p.id,
    sku: p.itemCode ?? p.id,
    name: formatDisplayName(p.name, category, p.designStyle),
    description: p.description ?? "",
    price,
    image: primaryImage,
    hoverImage,
    images,
    category,
    catalogueId: p.id,
    video: null,
    variantId,
    badge: p.comingSoon
      ? "Coming Soon"
      : price != null && autoDiscountPercent && autoDiscountPercent > 0 // none on Price on Request (STG-67)
        ? `${Math.round(autoDiscountPercent)}% off`
        : index === 0
          ? "Best Seller"
          : undefined,
    meta: "Insured Delivery",
    metals,
    styleText,
    inStock,
    priceHidden,
    hasMultiplePrices,
    autoDiscountPercent:
      autoDiscountPercent && autoDiscountPercent > 0 ? autoDiscountPercent : undefined,
  };
}
