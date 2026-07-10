import { prisma } from "@/lib/prisma";

/**
 * Admin-editable site content (banners, hero copy, promo bar) — SiteBanner
 * rows keyed by `slot`, managed at /admin/content.
 *
 * Design rule: every call site keeps its current hard-coded content as the
 * FALLBACK. No row (or `active: false`) → the built-in default renders, so
 * a missing/deleted banner can never blank a page.
 *
 * Wired slots today:
 *   promo-bar            → PromoBar text + link
 *   home-hero            → home hero headline / subtitle / CTA / image
 *   plp-hero-<category>  → category page hero image override
 *
 * To make ANY new surface customizable:
 *   1. pick a slot name, add it to KNOWN_SLOTS (admin UI lists it)
 *   2. call getBanner("your-slot") in the server component
 *   3. spread over your defaults: value?.title ?? DEFAULT_TITLE
 */

export type BannerContent = {
  slot: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  ctaLabel: string | null;
};

/** Slots the admin content page offers for editing. */
export const KNOWN_SLOTS: { slot: string; description: string }[] = [
  { slot: "promo-bar", description: "Top promo bar — title text + optional link" },
  { slot: "home-hero", description: "Home hero — headline, subtitle, CTA label, image" },
  { slot: "plp-hero-necklaces", description: "Necklaces category hero image" },
  { slot: "plp-hero-earrings", description: "Earrings category hero image" },
  { slot: "plp-hero-rings", description: "Rings category hero image" },
  { slot: "plp-hero-bracelets", description: "Bracelets category hero image" },
  { slot: "plp-hero-pendants", description: "Pendants category hero image" },
];

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
