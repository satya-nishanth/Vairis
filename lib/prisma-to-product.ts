import type { Product as PrismaProduct, ProductVariant, GoldRate } from "@prisma/client";
import { calculatePrice } from "@/lib/pricing";
import { prismaCategoryToSlug } from "@/lib/categories";
import type { Product } from "@/lib/ui-data";
import type { ProductCategory } from "@/lib/catalogue-ui";

type PrismaProductWithVariants = PrismaProduct & {
  variants: ProductVariant[];
};

export function prismaToProduct(
  p: PrismaProductWithVariants,
  goldRates: GoldRate[],
  index = 0,
): Product {
  let price: number | undefined;
  let variantId: string | undefined;
  if (!p.comingSoon && p.variants.length > 0 && goldRates.length > 0) {
    const rateMap = Object.fromEntries(
      goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]),
    );
    const priced = p.variants
      .map((v) => {
        const rate = rateMap[v.metalType];
        if (!rate) return null;
        const total = calculatePrice(
          {
            weightGrams: Number(v.weightGrams),
            makingChargePerGram: Number(v.makingChargePerGram),
            flatMakingCharge: Number(v.flatMakingCharge),
            stoneCharges: Number(v.stoneCharges),
            miscCharges: Number(v.miscCharges),
          },
          rate,
        ).total;
        return { id: v.id, total };
      })
      .filter((x): x is { id: string; total: number } => x !== null);
    if (priced.length > 0) {
      const cheapest = priced.reduce((a, b) => (b.total < a.total ? b : a));
      price = Math.round(cheapest.total);
      variantId = cheapest.id;
    }
  }

  const category: ProductCategory = prismaCategoryToSlug(p.category);

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
    variantId,
    badge: p.comingSoon ? "Coming Soon" : index === 0 ? "Best Seller" : undefined,
    meta: "Insured Delivery",
  };
}
