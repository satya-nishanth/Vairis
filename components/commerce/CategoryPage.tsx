import { CategoryPageView } from "@/components/commerce/CategoryPageView";
import { pickRandomCategoryStory } from "@/lib/category-stories";
import type { ShopCategory } from "@/lib/catalogue-ui";
import type { Product } from "@/lib/ui-data";

type CategoryPageProps = {
  category: ShopCategory;
  prismaProducts?: Product[];
};

/** Server wrapper: picks hero story once so client hydration matches. */
export function CategoryPage({ category, prismaProducts }: CategoryPageProps) {
  const story = pickRandomCategoryStory(category);
  return (
    <CategoryPageView
      category={category}
      story={story}
      prismaProducts={prismaProducts}
    />
  );
}
