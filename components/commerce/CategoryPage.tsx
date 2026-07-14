import { CategoryPageView } from "@/components/commerce/CategoryPageView";
import { pickRandomCategoryStory, type CategoryStory } from "@/lib/category-stories";
import type { ShopCategory } from "@/lib/catalogue-ui";
import type { Product } from "@/lib/ui-data";

type CategoryPageProps = {
  category: ShopCategory;
  prismaProducts?: Product[];
  /** Admin banner override (slot plp-hero-<category>) — falls back to built-in hero set. */
  heroImageOverride?: string;
  /** Admin story override — title->line1, subtitle->line2. Falls back to random built-in. */
  storyOverride?: CategoryStory | null;
  /** Admin intro override (SiteBanner.ctaLabel for category slots). */
  introOverride?: string | null;
};

/** Server wrapper: picks hero story once so client hydration matches. */
export function CategoryPage({
  category,
  prismaProducts,
  heroImageOverride,
  storyOverride,
  introOverride,
}: CategoryPageProps) {
  const story = storyOverride ?? pickRandomCategoryStory(category);
  return (
    <CategoryPageView
      category={category}
      story={story}
      prismaProducts={prismaProducts}
      heroImageOverride={heroImageOverride}
      introOverride={introOverride ?? undefined}
    />
  );
}
