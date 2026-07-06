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
