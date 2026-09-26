import type { Product as PrismaProduct, ProductVariant, GoldRate } from "@prisma/client";
import { calculatePrice, DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/lib/pricing";
import { toStoneInputs, resolvePriceVisibility, type StoneWithRate } from "@/lib/pricing-data";
import { prismaCategoryToSlug } from "@/lib/categories";
import type { Product } from "@/lib/ui-data";
import type { ProductCategory } from "@/lib/catalogue-ui";

type PrismaProductWithVariants = PrismaProduct & {
  variants: ProductVariant[];
  stones?: StoneWithRate[];
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
): Product {
  const priceHidden = !resolvePriceVisibility(p.priceVisibility, showPricesGlobal);
  let price: number | undefined;
  let variantId: string | undefined;
  let hasMultiplePrices = false;
  if (!priceHidden && !p.comingSoon && p.variants.length > 0 && goldRates.length > 0) {
    const rateMap = Object.fromEntries(
      goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]),
    );
    const stones = toStoneInputs(p.stones ?? []);
    const priced = p.variants
      .map((v) => {
        const rate = rateMap[v.metalType];
        const weight = Number(v.weightGrams);
        // Skip stub variants (weight 0) — avoid fake ₹misc-only prices
        if (!rate || !(weight > 0)) return null;
        // PLP "from" price: cheapest variant, without-exchange diamond rate
        const total = calculatePrice(
          {
            weightGrams: weight,
            makingChargePerGram: Number(v.makingChargePerGram),
            flatMakingCharge: Number(v.flatMakingCharge),
            stoneCharges: Number(v.stoneCharges),
            miscCharges: Number(v.miscCharges),
          },
          rate,
          { stones, withExchange: false, config: pricingConfig },
        ).total;
        return { id: v.id, total };
      })
      .filter((x): x is { id: string; total: number } => x !== null);
    if (priced.length > 0) {
      const cheapest = priced.reduce((a, b) => (b.total < a.total ? b : a));
      const mostExpensive = priced.reduce((a, b) => (b.total > a.total ? b : a));
      price = Math.round(cheapest.total);
      variantId = cheapest.id;
      hasMultiplePrices = priced.length > 1 && Math.round(cheapest.total) !== Math.round(mostExpensive.total);
    }
  }

  const category: ProductCategory = prismaCategoryToSlug(p.category);

  const images = (p.images ?? []).filter(Boolean);
  const primaryImage = images.find((src) => !/\.(mp4|webm|mov)(\?|$)/i.test(src)) ?? images[0] ?? "";

  // PLP filter facets
  const METAL_FILTER_LABELS: Record<string, string[]> = {
    GOLD_18K: ["Yellow Gold", "18K Gold"],
    GOLD_14K: ["Yellow Gold", "14K Gold"],
    ROSE_GOLD: ["Rose Gold"],
  };
  const metals = [...new Set(p.variants.flatMap((v) => METAL_FILTER_LABELS[v.metalType] ?? []))];
  const styleText = [p.designStyle ?? "", p.description ?? "", p.name].join(" ").toLowerCase();
  const inStock = p.variants.some((v) => v.stock > 0);

  return {
    slug: p.id,
    sku: p.itemCode ?? p.id,
    name: formatDisplayName(p.name, category, p.designStyle),
    description: p.description ?? "",
    price,
    image: primaryImage,
    images,
    category,
    catalogueId: p.id,
    video: null,
    variantId,
    badge: p.comingSoon ? "Coming Soon" : index === 0 ? "Best Seller" : undefined,
    meta: "Insured Delivery",
    metals,
    styleText,
    inStock,
    priceHidden,
    hasMultiplePrices,
  };
}
