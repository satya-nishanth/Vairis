import { CategoryPageView } from "@/components/commerce/CategoryPageView";
import { pickRandomCategoryStory } from "@/lib/category-stories";
import type { ShopCategory } from "@/lib/catalogue-ui";
import type { Product } from "@/lib/ui-data";

type CategoryPageProps = {
  category: ShopCategory;
  prismaProducts?: Product[];
  /** Admin banner override (slot plp-hero-<category>) — falls back to built-in hero set. */
  heroImageOverride?: string;
};

/** Server wrapper: picks hero story once so client hydration matches. */
export function CategoryPage({ category, prismaProducts, heroImageOverride }: CategoryPageProps) {
  const story = pickRandomCategoryStory(category);
  return (
    <CategoryPageView
      category={category}
      story={story}
      prismaProducts={prismaProducts}
      heroImageOverride={heroImageOverride}
    />
  );
}
