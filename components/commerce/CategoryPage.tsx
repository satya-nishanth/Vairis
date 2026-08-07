import { CategoryPageView } from "@/components/commerce/CategoryPageView";
import { getDefaultCategoryStory, type CategoryStory } from "@/lib/category-stories";
import type { ShopCategory } from "@/lib/catalogue-ui";
import type { Product } from "@/lib/ui-data";
import type { BannerImageFit } from "@/lib/banner-image-fit";

type CategoryPageProps = {
  category: ShopCategory;
  prismaProducts?: Product[];
  /** Admin carousel override - falls back to built-in hero set when empty/undefined. */
  heroImagesOverride?: string[];
  heroImageFits?: BannerImageFit[];
  storyOverride?: CategoryStory | null;
  introOverride?: string | null;
};

/** Server wrapper: stable default story so admin preview matches storefront. */
export function CategoryPage({
  category,
  prismaProducts,
  heroImagesOverride,
  heroImageFits,
  storyOverride,
  introOverride,
}: CategoryPageProps) {
  const story = storyOverride ?? getDefaultCategoryStory(category);
  return (
    <CategoryPageView
      category={category}
      story={story}
      prismaProducts={prismaProducts}
      heroImagesOverride={heroImagesOverride}
      heroImageFits={heroImageFits}
      introOverride={introOverride ?? undefined}
    />
  );
}
