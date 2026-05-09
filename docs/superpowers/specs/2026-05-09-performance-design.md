# Performance — P0 Implementation Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate sluggishness across the store — instant page navigation feedback, static PDP pages, client-side category filtering, and upload-time image resizing.

**Architecture:** Three independent improvements applied together: (1) Next.js `loading.tsx` skeleton files for immediate visual feedback during SSR, (2) static pre-rendering of all PDP pages via `generateStaticParams` + ISR shop page with client-side category filter, (3) Sharp resize on admin image upload + enforced image slot order (Front · Left · Right · Back · Video).

**Tech Stack:** Next.js 14 App Router, Sharp (image processing), Tailwind CSS `animate-pulse`, Supabase Storage

---

## Problem Summary

| Problem | Root Cause |
|---|---|
| Clicking product feels frozen | No `loading.tsx` — browser waits silently for SSR |
| Shop category clicks are slow | `await searchParams` makes page fully dynamic — DB hit every click |
| PDP slow on first visit | No `generateStaticParams` — SSR cold hit per product per 60s window |
| Large images slow cold loads | Raw full-res files stored (4000px+, 5–8MB) — Next.js cold-transforms on first request |
| Back photo appears first | No enforced slot order in upload UI |

---

## Section 1: Loading Skeletons

Two `loading.tsx` files. Next.js App Router automatically shows these while the page's server component runs.

### `app/(store)/shop/loading.tsx`

Grid skeleton matching the real shop layout:
- Header placeholder (title + filter bar)
- 8 product card skeletons in the same `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` grid
- Each card: `aspect-square` pulse block + two text line placeholders below
- Pure Tailwind `animate-pulse` — no JS, no packages

### `app/(store)/shop/product/[id]/loading.tsx`

PDP skeleton matching the real two-column layout:
- Left: square `aspect-square` pulse block (media gallery placeholder)
- Right: stacked text pulses — name (tall), category (short), price (medium), two button placeholders
- Mobile: stacks vertically, matches real PDP responsive layout

**Result:** Any navigation to shop or a product page shows shimmer immediately. SSR runs behind it. User sees feedback in <16ms instead of waiting 500ms+ in silence.

---

## Section 2: Static PDP + Static Category Pages + ISR Shop

### Routing reality

Two separate route files handle category browsing:

| URL | File | Used by |
|---|---|---|
| `/shop` | `app/(store)/shop/page.tsx` | "All" link, direct visits |
| `/shop/rings` | `app/(store)/shop/[category]/page.tsx` | Navbar, HeroCarousel, PDP breadcrumb |
| `/shop?category=rings` | `app/(store)/shop/page.tsx` (via searchParams) | Shop page filter pills only |

The `?category=rings` pattern is a dead end — it conflicts with the primary `/shop/rings` route used everywhere else and forces the shop page to SSR. **Eliminate it.**

### PDP — `app/(store)/shop/product/[id]/page.tsx`

Add `generateStaticParams`:

```typescript
export async function generateStaticParams() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true },
  })
  return products.map((p) => ({ id: p.id }))
}
```

Change `revalidate = 60` → `revalidate = 120`.

**How it works:**
- Build time: Next.js pre-renders all 23 active product pages as static HTML
- Stored at Vercel CDN edge — loads in ~50ms instead of 500ms+
- After 120s, next visitor to a stale page triggers silent background re-render (ISR)
- When admin edits a product: visible to next visitor within 120s

**Future extension:** Call `revalidatePath('/shop/product/[id]')` from the admin product update API route for instant cache busting. Not included now — 120s lag acceptable.

### Category Pages — `app/(store)/shop/[category]/page.tsx`

Add `generateStaticParams` for the 4 known categories:

```typescript
export async function generateStaticParams() {
  return ['rings', 'earrings', 'pendants', 'bracelets'].map((c) => ({ category: c }))
}
```

Change `revalidate = 60` → `revalidate = 120`.

**How it works:**
- Build time: Next.js pre-renders `/shop/rings`, `/shop/earrings`, `/shop/pendants`, `/shop/bracelets` as static HTML
- Navbar + HeroCarousel + PDP breadcrumb links already point to `/shop/rings` etc. — these become instant CDN loads
- After 120s, next visitor triggers background re-render (ISR)

### Shop Page — `app/(store)/shop/page.tsx`

Remove `searchParams` entirely. Page shows all products, no category filtering.

Change filter pills from `?category=rings` links to `/shop/rings` links — consistent with navbar. Filter pills become standard `<Link>` components pointing to the static category pages.

```typescript
export const revalidate = 120

export default async function ShopPage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { id, name, itemCode, category, images, stoneType, caratWeight, comingSoon },
  })
  // No searchParams — clean ISR, no DB hit per request
  return (
    <div>
      {/* Filter pills now link to /shop/rings etc — static pages */}
      <FilterPills /> 
      <ProductGrid products={products} />
    </div>
  )
}
```

**Pagination:** Not needed now (23 products). When catalogue exceeds ~80–100 products, add client-side slice or cursor-based API. No architecture change needed.

**Result:**
- `/shop` — ISR cached, instant
- `/shop/rings` — statically pre-rendered, CDN, ~50ms
- Switching categories = CDN page load (~50ms) not client-side filter — fast enough, simpler code
- No `ShopGrid` client component needed
- All image URLs in HTML, bytes lazy-loaded by browser

---

## Section 3: Sharp Upload Resize + Image Order

### Upload Resize — `app/api/admin/upload/route.ts`

Add Sharp to pipeline for images only. Videos skip processing entirely.

**Install:** `npm install sharp` + `npm install --save-dev @types/sharp`

**Upload flow:**
```
Incoming file
  ↓
Is video? (mp4/webm/mov/avi by extension)
  → YES: size check (reject if >50MB) → upload to Supabase as-is
  → NO (image):
      → buffer → Sharp().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
               → .jpeg({ quality: 85 })
               → upload to Supabase as JPEG
```

- `fit: 'inside'` preserves aspect ratio, never upscales
- `withoutEnlargement: true` — images already under 1200px stored unchanged
- Output always JPEG regardless of input format (PNG, HEIC, WebP all converted)
- Filename gets `.jpg` extension after processing

**Storage impact:** ~8MB raw → ~150–300KB stored. 23 products × 4 images = ~28MB vs ~700MB current.

**Vercel constraint:** Sharp runs in Vercel serverless (Node.js runtime). Resize adds ~200ms per image — acceptable for admin upload, invisible to shoppers.

**Video guidance in upload UI:** Display note: *"Keep videos under 50MB · 720p recommended · 15 seconds max."* Reject server-side with 413 if >50MB.

### Image Slot Order — `components/admin/ImageUploader.tsx` + `components/store/MediaGallery.tsx`

**Enforced order:** Front · Left · Right · Back · Video (optional)

`ImageUploader.tsx` changes:
- Replace free-form multi-upload with 5 named slots: Front, Left, Right, Back, Video
- Each slot: click to upload or drag-drop, shows thumbnail when filled, click to replace
- Slots map directly to array indices: `[0]=front, [1]=left, [2]=right, [3]=back, [4]=video`
- Empty slots stored as `null` in array, filtered out before saving to DB (`images.filter(Boolean)`)
- Video slot only accepts video file types; image slots reject video types
- Upload hint per slot: *"Front view"*, *"Left side"*, *"Right side"*, *"Back view"*, *"Video (≤50MB)"*

`MediaGallery.tsx`:
- No change to display logic — index 0 is already shown first
- `isVideo()` check already in `lib/imageUrl.ts` — video renders as `<video>` regardless of position
- Video always renders with controls, autoplay muted loop (existing behaviour)

**Existing products:** Current `images[]` arrays have no enforced order — no migration needed. Admin should re-upload in correct order when editing existing products. The upload UI will show existing images in current array order with slot labels.

---

## Out of Scope

- Video transcoding (requires dedicated service like Cloudflare Stream/Mux — Vercel 10s timeout makes it impossible)
- Server-side pagination (add client-side slice to `ShopGrid` when needed)
- `revalidatePath` on admin save (120s ISR lag acceptable now)
- Homepage hero carousel (separate component, not affected)
- Category page routes (`/shop/rings`) — can redirect to `/shop?category=rings` or apply same ISR pattern separately

---

## Files Changed

| File | Change |
|---|---|
| `app/(store)/shop/loading.tsx` | **Create** — grid skeleton |
| `app/(store)/shop/[category]/loading.tsx` | **Create** — category grid skeleton |
| `app/(store)/shop/product/[id]/loading.tsx` | **Create** — PDP skeleton |
| `app/(store)/shop/page.tsx` | **Modify** — remove searchParams, change filter pills to /shop/[category] links, revalidate=120 |
| `app/(store)/shop/[category]/page.tsx` | **Modify** — add generateStaticParams for 4 categories, revalidate=120 |
| `app/(store)/shop/product/[id]/page.tsx` | **Modify** — add generateStaticParams for all active products, revalidate=120 |
| `app/api/admin/upload/route.ts` | **Modify** — Sharp resize pipeline |
| `components/admin/ImageUploader.tsx` | **Modify** — named slots (Front/Left/Right/Back/Video) |
| `package.json` | **Modify** — add sharp dependency |
