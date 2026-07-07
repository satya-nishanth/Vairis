"use client";

import { CategoryCard } from "@/components/commerce/CategoryCard";
import type { ShopCategory } from "@/lib/catalogue-ui";

type CategoryItem = {
  slug: ShopCategory;
  title: string;
  description: string;
  images: string[];
};

type CategoryCarouselSectionProps = {
  categories: CategoryItem[];
  variant?: "marquee" | "compact";
};

export function CategoryCarouselSection({ categories, variant = "marquee" }: CategoryCarouselSectionProps) {
  const isCompact = variant === "compact";
  const items = isCompact ? categories : [...categories, ...categories];

  return (
    <div
      className={`category-carousel${isCompact ? " category-carousel--compact" : ""}`}
      aria-label="Shop by category"
    >
      <div className="category-carousel__track">
        {items.map((cat, index) => (
          <div key={`${cat.slug}-${index}`} className="category-carousel__slide">
            <CategoryCard
              slug={cat.slug}
              title={cat.title}
              description={cat.description}
              images={cat.images}
              compact={isCompact}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
