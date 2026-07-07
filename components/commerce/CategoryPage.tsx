import { CategoryPageView } from "@/components/commerce/CategoryPageView";
import { pickRandomCategoryStory } from "@/lib/category-stories";
import type { ShopCategory } from "@/lib/catalogue-ui";

type CategoryPageProps = {
  category: ShopCategory;
};

/** Server wrapper: picks hero story once so client hydration matches. */
export function CategoryPage({ category }: CategoryPageProps) {
  const story = pickRandomCategoryStory(category);
  return <CategoryPageView category={category} story={story} />;
}
