import { prisma } from "@/lib/prisma";
import {
  CATEGORY_LABELS,
  HEADER_NAV_CATEGORIES,
  SHOP_CATEGORIES,
  isShopCategory,
  type ShopCategory,
} from "@/lib/catalogue-ui";
import {
  normalizeImageFits,
  type BannerImageFit,
} from "@/lib/banner-image-fit";

/**
 * Admin-editable site content (banners, hero copy, promo bar) - SiteBanner
 * rows keyed by `slot`, managed at /admin/content.
 *
 * Design rule: every call site keeps its current hard-coded content as the
 * FALLBACK. No row (or `active: false`) -> the built-in default renders, so
 * a missing/deleted banner can never blank a page.
 *
 * images[] = unlimited ordered carousel URLs (preferred).
 * imageUrl = legacy single image (used when images is empty).
 * imageFits[] = per-slide web/mobile object-position (aligned with images[]).
 */

export type { BannerImageFit };

export type BannerContent = {
  slot: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  images: string[];
  imageFits: BannerImageFit[];
  linkUrl: string | null;
  ctaLabel: string | null;
};

export type ContentSlot = {
  slot: string;
  description: string;
  label: string;
  group: "global" | "category-hero";
};

export function categoryHeroSlot(slug: string): string {
  return `plp-hero-${slug}`;
}

/** Prefer images[]; fall back to single imageUrl. */
export function bannerImageList(banner: {
  images?: string[] | null;
  imageUrl?: string | null;
} | null | undefined): string[] {
  if (!banner) return [];
  const multi = (banner.images ?? []).filter(Boolean);
  if (multi.length > 0) return multi;
  return banner.imageUrl ? [banner.imageUrl] : [];
}

export const CATEGORY_HERO_SLOTS: ContentSlot[] = HEADER_NAV_CATEGORIES.map((slug) => ({
  slot: categoryHeroSlot(slug),
  label: CATEGORY_LABELS[slug].title,
  description: `Hero carousel on ${CATEGORY_LABELS[slug].title} shop page (navbar item)`,
  group: "category-hero" as const,
}));

export const OTHER_SHOP_HERO_SLOTS: ContentSlot[] = SHOP_CATEGORIES.filter(
  (slug) => !(HEADER_NAV_CATEGORIES as readonly string[]).includes(slug),
).map((slug) => ({
  slot: categoryHeroSlot(slug),
  label: CATEGORY_LABELS[slug].title,
  description: `Hero for ${CATEGORY_LABELS[slug].title} - not in main nav yet; add to HEADER_NAV_CATEGORIES to show in header`,
  group: "category-hero" as const,
}));

const GLOBAL_SLOTS: ContentSlot[] = [
  {
    slot: "promo-bar",
    label: "Promo bar",
    description: "Top promo bar - title text + optional link",
    group: "global",
  },
  {
    slot: "home-hero",
    label: "Home hero",
    description: "Home hero - headline, subtitle, CTA, unlimited carousel images",
    group: "global",
  },
];

export const KNOWN_SLOTS: ContentSlot[] = [
  ...GLOBAL_SLOTS,
  ...CATEGORY_HERO_SLOTS,
  ...OTHER_SHOP_HERO_SLOTS,
];

export function isKnownContentSlot(slot: string): boolean {
  if (KNOWN_SLOTS.some((s) => s.slot === slot)) return true;
  const match = /^plp-hero-(.+)$/.exec(slot);
  return Boolean(match && isShopCategory(match[1]));
}

export function parseCategoryHeroSlot(slot: string): ShopCategory | null {
  const match = /^plp-hero-(.+)$/.exec(slot);
  if (!match || !isShopCategory(match[1])) return null;
  return match[1];
}

export async function getBanner(slot: string): Promise<BannerContent | null> {
  try {
    const row = await prisma.siteBanner.findUnique({ where: { slot } });
    if (!row || !row.active) return null;
    const images = bannerImageList(row);
    const imageFits = normalizeImageFits(
      images,
      (row as { imageFits?: unknown }).imageFits,
    );
    return {
      slot: row.slot,
      title: row.title,
      subtitle: row.subtitle,
      imageUrl: images[0] ?? row.imageUrl,
      images,
      imageFits,
      linkUrl: row.linkUrl,
      ctaLabel: row.ctaLabel,
    };
  } catch {
    return null;
  }
}
