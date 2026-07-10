# Site Content / Banners — Phase 5

Goal: every marketing surface (promo bar, hero, category banners) editable from admin without code changes.

## Model

```prisma
model SiteBanner {
  id        String   @id @default(cuid())
  slot      String   @unique   // e.g. "promo-bar", "home-hero", "plp-hero-rings"
  title     String?
  subtitle  String?
  imageUrl  String?
  linkUrl   String?
  ctaLabel  String?
  active    Boolean  @default(true)
  updatedAt DateTime @updatedAt
}
```

## Read path

`lib/site-content.ts` → `getBanner(slot)` / `getBanners(prefix)`; server components fetch with `revalidate: 300`-style caching (dynamic pages just query). Every call site keeps its current hard-coded content as **fallback** when no active row exists — zero risk to existing pages.

## Slots wired in this phase

| Slot | Surface |
|------|---------|
| `promo-bar` | PromoBar text + link |
| `home-hero` | Home hero headline/sub/CTA/image |
| `plp-hero-<category>` | Category page hero image override |

Remaining surfaces (why-vairis, founders, video thumbs) follow the same pattern — add slot, wire fallback.

## Admin

`/admin/content` — table of slots, edit form (title/subtitle/image upload via existing `/api/admin/upload`, link, CTA, active toggle). Admin-gated APIs: `GET/PUT /api/admin/content/[slot]`.

Acceptance: change promo-bar text + home hero image from admin → visible on storefront without deploy; deleting/deactivating a row falls back to built-in content.
