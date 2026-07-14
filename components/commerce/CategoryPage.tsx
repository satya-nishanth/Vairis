import { CategoryPageView } from "@/components/commerce/CategoryPageView";
import { pickRandomCategoryStory, type CategoryStory } from "@/lib/category-stories";
import type { ShopCategory } from "@/lib/catalogue-ui";
import type { Product } from "@/lib/ui-data";

type CategoryPageProps = {
  category: ShopCategory;
  prismaProducts?: Product[];
  /** Admin carousel override - falls back to built-in hero set when empty/undefined. */
  heroImagesOverride?: string[];
  storyOverride?: CategoryStory | null;
  introOverride?: string | null;
};

/** Server wrapper: picks hero story once so client hydration matches. */
export function CategoryPage({
  category,
  prismaProducts,
  heroImagesOverride,
  storyOverride,
  introOverride,
}: CategoryPageProps) {
  const story = storyOverride ?? pickRandomCategoryStory(category);
  return (
    <CategoryPageView
      category={category}
      story={story}
      prismaProducts={prismaProducts}
      heroImagesOverride={heroImagesOverride}
      introOverride={introOverride ?? undefined}
    />
  );
}
