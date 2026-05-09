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

## Section 2: Static PDP + ISR Shop with Client-Side Filter

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
- Build time: Next.js calls `generateStaticParams`, pre-renders all active product pages as static HTML
- Stored at Vercel CDN edge — loads in ~50ms instead of 500ms+
- After 120s, next visitor to a stale page triggers silent background re-render (ISR)
- When admin edits a product: visible to next visitor within 120s

**Future extension:** Call `revalidatePath('/shop/product/[id]')` from the admin product update API route for instant cache busting. Not included now — 120s lag acceptable.

### Shop Page — `app/(store)/shop/page.tsx` + new `components/store/ShopGrid.tsx`

**Why searchParams breaks ISR:** Accessing `await searchParams` inside a server component marks the entire page as dynamically rendered — `revalidate` is ignored, every request hits the DB. `/shop`, `/shop?category=rings`, `/shop?category=earrings` all SSR cold every time.

**Fix:** Remove searchParams from `page.tsx` entirely. Page fetches all products once (ISR). A `'use client'` `ShopGrid` component filters in the browser.

`page.tsx` becomes:
```typescript
export const revalidate = 120

export default async function ShopPage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { id, name, itemCode, category, images, stoneType, caratWeight, comingSoon },
  })
  return <ShopGrid products={products} />
}
```

`ShopGrid.tsx` (new client component):
- Receives all products as props (~5KB JSON, already in HTML)
- Reads initial category from `useSearchParams()` on mount for shareable URLs
- `useState` for active category filter
- `useRouter().push()` updates URL on filter change (back button works, links shareable)
- Filters products in-memory — zero network request
- Renders same `ProductCard` grid as before

**Pagination:** Not needed now (23 products). Client-side slice can be added to `ShopGrid` when catalogue exceeds ~80–100 products — no architecture change required.

**Result:**
- `/shop` loads from ISR cache — instant
- Category filter clicks → instant JS filter, URL updates, zero DB
- All 23 product image URLs in HTML, actual image bytes lazy-loaded by browser

### Category Pages — `app/(store)/shop/[category]/page.tsx`

Same treatment: remove searchParams dependency if present, or redirect to `/shop?category=X` and let ShopGrid handle it. Simplifies routing.

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
| `app/(store)/shop/product/[id]/loading.tsx` | **Create** — PDP skeleton |
| `app/(store)/shop/page.tsx` | **Modify** — remove searchParams, add ISR, render ShopGrid |
| `app/(store)/shop/product/[id]/page.tsx` | **Modify** — add generateStaticParams, revalidate=120 |
| `components/store/ShopGrid.tsx` | **Create** — client filter component |
| `app/api/admin/upload/route.ts` | **Modify** — Sharp resize pipeline |
| `components/admin/ImageUploader.tsx` | **Modify** — named slots (Front/Left/Right/Back/Video) |
| `package.json` | **Modify** — add sharp dependency |
