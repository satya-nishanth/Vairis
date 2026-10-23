import { CategoryPageView } from "@/components/commerce/CategoryPageView";
import { getDefaultCategoryStory, type CategoryStory } from "@/lib/category-stories";
import { isShopCategory, type ShopCategory } from "@/lib/catalogue-ui";
import type { Product } from "@/lib/ui-data";
import type { BannerImageFit } from "@/lib/banner-image-fit";

type CategoryPageProps = {
  category: string;
  categoryTitle?: string;
  categoryIntro?: string;
  prismaProducts?: Product[];
  /** Admin carousel override - falls back to built-in hero set when empty/undefined. */
  heroImagesOverride?: string[];
  heroImageFits?: BannerImageFit[];
  storyOverride?: CategoryStory | null;
  introOverride?: string | null;
  filterOptions?: { types: string[]; occasions: string[] };
};

/** Server wrapper: stable default story so admin preview matches storefront. */
export function CategoryPage({
  category,
  categoryTitle,
  categoryIntro,
  prismaProducts,
  heroImagesOverride,
  heroImageFits,
  storyOverride,
  introOverride,
  filterOptions,
}: CategoryPageProps) {
  const story =
    storyOverride ??
    (isShopCategory(category)
      ? getDefaultCategoryStory(category)
      : {
          line1: `Curated ${categoryTitle || category}`,
          line2: "Everyday fine jewellery crafted for real life.",
        });

  return (
    <CategoryPageView
      category={category}
      titleOverride={categoryTitle}
      story={story}
      prismaProducts={prismaProducts}
      heroImagesOverride={heroImagesOverride}
      heroImageFits={heroImageFits}
      introOverride={introOverride ?? categoryIntro ?? undefined}
      filterOptions={filterOptions}
    />
  );
}
