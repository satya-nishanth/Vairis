import type { ProductCategory } from "@/lib/catalogue-ui";

/**
 * Single source of truth for Prisma Category enum ↔ storefront slug mapping.
 * Add new categories here (and in prisma/schema.prisma) — nowhere else.
 */
export const PRISMA_TO_SLUG = {
  RINGS: "rings",
  EARRINGS: "earrings",
  PENDANTS: "pendants",
  BRACELETS: "bracelets",
  NECKLACES: "necklaces",
} as const satisfies Record<string, ProductCategory>;

export type PrismaCategory = keyof typeof PRISMA_TO_SLUG;

export const SLUG_TO_PRISMA: Record<string, PrismaCategory> = Object.fromEntries(
  Object.entries(PRISMA_TO_SLUG).map(([k, v]) => [v, k as PrismaCategory]),
);

export function prismaCategoryToSlug(category: string): ProductCategory {
  return PRISMA_TO_SLUG[category as PrismaCategory] ?? "other";
}
