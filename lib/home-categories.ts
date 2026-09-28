import { prisma } from "@/lib/prisma";
import { getStoreCategories } from "@/lib/store-categories";
import {
  CATEGORY_LABELS,
  getCategoryHeroImage,
  getCategoryPreviewImages,
  STOCKED_CATEGORIES,
} from "@/lib/catalogue-ui";
import { SLUG_TO_PRISMA } from "@/lib/categories";
import { marketingImages } from "@/lib/images";
import type { Category } from "@prisma/client";

export type HomeCategoryCarouselItem = {
  slug: string;
  title: string;
  description: string;
  images: string[];
};

/**
 * Returns category cards for the homepage category carousel.
 * STRICT REQUIREMENT: Only active products (`isActive: true` AND `status === 'LIVE'`)
 * that are selected in each category are included. Products in DRAFT or AI_DRAFT
 * are strictly excluded.
 */
export async function getHomeCategoryCarouselItems(): Promise<HomeCategoryCarouselItem[]> {
  try {
    const storeCategories = await getStoreCategories({ activeOnly: true }).catch(() => []);

    const targetCategories =
      storeCategories.length > 0
        ? storeCategories.map((c) => ({
            slug: c.slug,
            name: c.name,
            description:
              c.description ||
              CATEGORY_LABELS[c.slug as keyof typeof CATEGORY_LABELS]?.description ||
              "",
            image: c.image,
            productIds: c.productIds ?? [],
          }))
        : STOCKED_CATEGORIES.map((slug) => ({
            slug,
            name: CATEGORY_LABELS[slug]?.title || slug,
            description: CATEGORY_LABELS[slug]?.description || "",
            image: null,
            productIds: [] as string[],
          }));

    const items: HomeCategoryCarouselItem[] = [];

    for (const cat of targetCategories) {
      const prismaCategory = SLUG_TO_PRISMA[cat.slug];

      let activeProducts: { id: string; images: string[] }[] = [];

      // 1. If products were explicitly assigned/selected in this category:
      if (cat.productIds.length > 0) {
        activeProducts = await prisma.product
          .findMany({
            where: {
              id: { in: cat.productIds },
              isActive: true,
              status: "LIVE", // Strictly only LIVE products (excludes DRAFT and AI_DRAFT)
            },
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
            select: { id: true, images: true },
            take: 8,
          })
          .catch(() => []);
      }

      // 2. Fallback to category taxonomy if no products were manually assigned:
      if (activeProducts.length === 0) {
        const orConditions: any[] = [];
        const notConditions: any[] = [];

        if (cat.slug === "mangalsutra") {
          orConditions.push({ name: { contains: "mangalsutra", mode: "insensitive" } });
        } else if (cat.slug === "necklaces") {
          if (prismaCategory) orConditions.push({ category: prismaCategory as Category });
          orConditions.push({ name: { contains: "necklace", mode: "insensitive" } });
        } else if (cat.slug === "pendants") {
          if (prismaCategory) orConditions.push({ category: prismaCategory as Category });
          notConditions.push(
            { name: { contains: "mangalsutra", mode: "insensitive" } },
            { name: { contains: "necklace", mode: "insensitive" } },
          );
        } else if (cat.slug === "bracelets") {
          if (prismaCategory) orConditions.push({ category: prismaCategory as Category });
          notConditions.push(
            { name: { contains: "earring", mode: "insensitive" } },
            { name: { contains: "stud", mode: "insensitive" } },
            { name: { contains: "cufflink", mode: "insensitive" } },
            { name: { contains: "mangalsutra", mode: "insensitive" } },
          );
        } else if (cat.slug === "earrings") {
          if (prismaCategory) orConditions.push({ category: prismaCategory as Category });
          orConditions.push(
            { name: { contains: "earring", mode: "insensitive" } },
            { name: { contains: "stud", mode: "insensitive" } },
          );
          notConditions.push({ name: { contains: "cufflink", mode: "insensitive" } });
        } else if (cat.slug === "cufflinks") {
          orConditions.push({ name: { contains: "cufflink", mode: "insensitive" } });
        } else if (prismaCategory) {
          orConditions.push({ category: prismaCategory as Category });
        }

        if (orConditions.length > 0 || prismaCategory) {
          activeProducts = await prisma.product
            .findMany({
              where: {
                isActive: true,
                status: "LIVE", // Strictly only LIVE products (excludes DRAFT and AI_DRAFT)
                ...(orConditions.length > 0 ? { OR: orConditions } : {}),
                ...(notConditions.length > 0 ? { NOT: notConditions } : {}),
              },
              orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
              select: { id: true, images: true },
              take: 8,
            })
            .catch(() => []);
        }
      }

      // Collect images from active LIVE products only
      const productImages: string[] = [];
      for (const prod of activeProducts) {
        if (prod.images && prod.images.length > 0) {
          for (const img of prod.images) {
            if (img && typeof img === "string" && !productImages.includes(img)) {
              productImages.push(img);
              if (productImages.length >= 6) break;
            }
          }
        }
        if (productImages.length >= 6) break;
      }

      if (productImages.length > 0) {
        items.push({
          slug: cat.slug,
          title: cat.name,
          description: cat.description,
          images: productImages,
        });
      } else {
        // Fallback for static mock / unseeded environments:
        // Only if no DB products exist at all, use catalogue preview images if available
        const fallbackPreviews = getCategoryPreviewImages(cat.slug as any, 6);
        const heroImg =
          cat.image ||
          getCategoryHeroImage(cat.slug as any) ||
          marketingImages.categories[cat.slug as keyof typeof marketingImages.categories];
        const finalImages =
          fallbackPreviews.length > 0 ? fallbackPreviews : heroImg ? [heroImg] : [];
        if (finalImages.length > 0) {
          items.push({
            slug: cat.slug,
            title: cat.name,
            description: cat.description,
            images: finalImages,
          });
        }
      }
    }

    return items;
  } catch (err) {
    console.error("[getHomeCategoryCarouselItems] Error:", err);
    return STOCKED_CATEGORIES.map((slug) => {
      const previewImages = getCategoryPreviewImages(slug);
      const heroImage = getCategoryHeroImage(slug) ?? marketingImages.categories[slug];
      return {
        slug,
        title: CATEGORY_LABELS[slug].title,
        description: CATEGORY_LABELS[slug].description,
        images: previewImages.length > 0 ? previewImages : [heroImage],
      };
    });
  }
}
