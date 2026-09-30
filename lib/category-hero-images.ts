import manifest from "@/data/category-hero-manifest.json";
import { marketingImages } from "@/lib/images";
import type { ShopCategory } from "@/lib/catalogue-ui";

type CategoryHeroManifest = {
  generatedAt: string;
  images: Record<string, string[]>;
};

const heroManifest = manifest as CategoryHeroManifest;

/** Hero carousel slides from public/images/category_hero/ (see npm run category-hero:sync). */
export function getCategoryHeroImages(category: ShopCategory): string[] {
  const fromDisk = heroManifest.images[category] ?? [];
  if (fromDisk.length > 0) return fromDisk;

  const fallback = marketingImages.plp.heroByCategory[category];
  return fallback ? [fallback] : [];
}

/** Single resilient hero image fallback for any category or title label */
export function getCategoryFallbackHero(categoryOrLabel: string): string {
  const norm = categoryOrLabel.toLowerCase().trim().replace(/[\s_]+/g, "-") as ShopCategory;
  const fromDisk = heroManifest.images[norm];
  if (fromDisk && fromDisk.length > 0 && fromDisk[0]) {
    return fromDisk[0];
  }
  const fallback = marketingImages.plp.heroByCategory[norm];
  if (fallback) return fallback;
  return "/images/category_hero/rings/rings.png";
}

