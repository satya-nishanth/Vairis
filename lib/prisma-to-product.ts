import type { Product as PrismaProduct, ProductVariant, GoldRate } from "@prisma/client";
import { calculatePrice } from "@/lib/pricing";
import type { Product } from "@/lib/ui-data";
import type { ProductCategory } from "@/lib/catalogue-ui";

const PRISMA_TO_CATALOGUE_CATEGORY: Record<string, ProductCategory> = {
  RINGS: "rings",
  EARRINGS: "earrings",
  PENDANTS: "pendants",
  BRACELETS: "bracelets",
};

type PrismaProductWithVariants = PrismaProduct & {
  variants: ProductVariant[];
};

export function prismaToProduct(
  p: PrismaProductWithVariants,
  goldRates: GoldRate[],
  index = 0,
): Product {
  let price: number | undefined;
  if (p.variants.length > 0 && goldRates.length > 0) {
    const rateMap = Object.fromEntries(
      goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]),
    );
    const prices = p.variants
      .map((v) => {
        const rate = rateMap[v.metalType];
        if (!rate) return null;
        return calculatePrice(
          {
            weightGrams: Number(v.weightGrams),
            makingChargePerGram: Number(v.makingChargePerGram),
            flatMakingCharge: Number(v.flatMakingCharge),
            stoneCharges: Number(v.stoneCharges),
            miscCharges: Number(v.miscCharges),
          },
          rate,
        ).total;
      })
      .filter((n): n is number => n !== null);
    if (prices.length > 0) price = Math.min(...prices);
  }

  const category: ProductCategory =
    PRISMA_TO_CATALOGUE_CATEGORY[p.category] ?? "other";

  return {
    slug: p.id,
    sku: p.itemCode ?? p.id,
    name: p.name,
    description: p.description ?? "",
    price,
    image: p.images[0] ?? "",
    images: p.images,
    category,
    catalogueId: p.id,
    video: null,
    badge: index === 0 ? "Best Seller" : undefined,
    meta: "Insured Delivery",
  };
}
