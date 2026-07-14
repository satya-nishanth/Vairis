import { prisma } from "@/lib/prisma";
import {
  CATEGORY_LABELS,
  HEADER_NAV_CATEGORIES,
  SHOP_CATEGORIES,
  isShopCategory,
  type ShopCategory,
} from "@/lib/catalogue-ui";

/**
 * Admin-editable site content (banners, hero copy, promo bar) — SiteBanner
 * rows keyed by `slot`, managed at /admin/content.
 *
 * Design rule: every call site keeps its current hard-coded content as the
 * FALLBACK. No row (or `active: false`) → the built-in default renders, so
 * a missing/deleted banner can never blank a page.
 *
 * Wired slots:
 *   promo-bar            → PromoBar text + link
 *   home-hero            → home hero headline / subtitle / CTA / image
 *   plp-hero-<category>  → /all-products/<category> hero image
 *                          (auto-listed from HEADER_NAV_CATEGORIES)
 *
 * Adding a new navbar category:
 *   1. Add slug to HEADER_NAV_CATEGORIES (+ Category enum / shop routing)
 *   2. Category hero slot appears automatically on /admin/content
 *   3. PLP already calls getBanner(`plp-hero-${category}`)
 */

export type BannerContent = {
  slot: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  ctaLabel: string | null;
};

export type ContentSlot = {
  slot: string;
  description: string;
  /** Friendly label for admin UI */
  label: string;
  group: "global" | "category-hero";
};

export function categoryHeroSlot(slug: string): string {
  return `plp-hero-${slug}`;
}

/** Navbar shop categories → one hero upload each. */
export const CATEGORY_HERO_SLOTS: ContentSlot[] = HEADER_NAV_CATEGORIES.map((slug) => ({
  slot: categoryHeroSlot(slug),
  label: CATEGORY_LABELS[slug].title,
  description: `Hero banner on ${CATEGORY_LABELS[slug].title} shop page (navbar item)`,
  group: "category-hero" as const,
}));

/** Extra shop categories not in the header yet — still uploadable for when you add them to nav. */
export const OTHER_SHOP_HERO_SLOTS: ContentSlot[] = SHOP_CATEGORIES.filter(
  (slug) => !(HEADER_NAV_CATEGORIES as readonly string[]).includes(slug),
).map((slug) => ({
  slot: categoryHeroSlot(slug),
  label: CATEGORY_LABELS[slug].title,
  description: `Hero for ${CATEGORY_LABELS[slug].title} — not in main nav yet; add to HEADER_NAV_CATEGORIES to show in header`,
  group: "category-hero" as const,
}));

const GLOBAL_SLOTS: ContentSlot[] = [
  {
    slot: "promo-bar",
    label: "Promo bar",
    description: "Top promo bar — title text + optional link",
    group: "global",
  },
  {
    slot: "home-hero",
    label: "Home hero",
    description: "Home hero — headline, subtitle, CTA label, image",
    group: "global",
  },
];

/** Slots the admin content page offers for editing. */
export const KNOWN_SLOTS: ContentSlot[] = [
  ...GLOBAL_SLOTS,
  ...CATEGORY_HERO_SLOTS,
  ...OTHER_SHOP_HERO_SLOTS,
];

/** Accept hardcoded slots + any plp-hero-<shopCategory> for future categories. */
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
    return {
      slot: row.slot,
      title: row.title,
      subtitle: row.subtitle,
      imageUrl: row.imageUrl,
      linkUrl: row.linkUrl,
      ctaLabel: row.ctaLabel,
    };
  } catch {
    // DB hiccup must never take down a marketing surface — fall back.
    return null;
  }
}
