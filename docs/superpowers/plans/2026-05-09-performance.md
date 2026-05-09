# Performance P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate store sluggishness — loading skeletons on navigation, static pre-rendering of all product and category pages, ISR shop page, Sharp resize on image upload, and enforced Front/Left/Right/Back/Video slot order in admin.

**Architecture:** Four independent tasks applied in order: (1) loading skeletons via Next.js `loading.tsx` for instant visual feedback, (2) `generateStaticParams` on PDP + category routes + ISR cleanup on shop page, (3) Sharp image resize pipeline in the upload API route, (4) named image slots in `ImageUploader`. Each task is independently committable and testable.

**Tech Stack:** Next.js 14 App Router, Sharp, Tailwind CSS `animate-pulse`, Supabase Storage, Prisma

**Spec:** `docs/superpowers/specs/2026-05-09-performance-design.md`

---

## File Map

| File | Task | Change |
|---|---|---|
| `app/(store)/shop/loading.tsx` | 0 | Create — all-products grid skeleton |
| `app/(store)/shop/[category]/loading.tsx` | 0 | Create — category grid skeleton |
| `app/(store)/shop/product/[id]/loading.tsx` | 0 | Create — PDP two-column skeleton |
| `app/(store)/shop/[category]/page.tsx` | 1 | Add `generateStaticParams`, revalidate=120 |
| `app/(store)/shop/product/[id]/page.tsx` | 1 | Add `generateStaticParams`, revalidate=120 |
| `app/(store)/shop/page.tsx` | 1 | Remove searchParams, filter pills → `/shop/[category]` links, revalidate=120 |
| `package.json` | 2 | Add `sharp` dependency |
| `app/api/admin/upload/route.ts` | 2 | Sharp resize pipeline for images, 50MB limit for videos |
| `components/admin/ImageUploader.tsx` | 3 | Named slots: Front · Left · Right · Back · Video |

---

## Task 0: Loading Skeletons

**Goal:** Three `loading.tsx` files that Next.js App Router auto-shows during SSR — user sees shimmer immediately on click instead of frozen blank screen.

**Files:**
- Create: `app/(store)/shop/loading.tsx`
- Create: `app/(store)/shop/[category]/loading.tsx`
- Create: `app/(store)/shop/product/[id]/loading.tsx`

**Acceptance Criteria:**
- [ ] Navigating to `/shop` shows animated shimmer grid before products load
- [ ] Navigating to `/shop/rings` shows same shimmer grid
- [ ] Navigating to `/shop/product/[id]` shows two-column shimmer skeleton
- [ ] No JS errors in console
- [ ] Skeletons match real page layout (same grid, same column split)

**Verify:** `npm run dev` → click products in browser → skeleton appears instantly on click

**Steps:**

- [ ] **Step 1: Create shop loading skeleton**

Create `app/(store)/shop/loading.tsx`:

```tsx
export default function ShopLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-14">
      {/* Header */}
      <div className="text-center mb-12 animate-pulse">
        <div className="h-3 w-24 bg-gray-200 rounded mx-auto mb-3" />
        <div className="h-10 w-48 bg-gray-200 rounded mx-auto" />
      </div>

      {/* Filter bar */}
      <div className="flex justify-center gap-2 mb-12 animate-pulse">
        {[80, 64, 80, 80, 72].map((w, i) => (
          <div key={i} className={`h-8 w-${w} bg-gray-200 rounded`} />
        ))}
      </div>

      {/* Product grid — 8 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square bg-gray-200 rounded-sm" />
            <div className="mt-3 space-y-2">
              <div className="h-2.5 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create category loading skeleton**

Create `app/(store)/shop/[category]/loading.tsx`:

```tsx
export default function CategoryLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-14">
      {/* Header */}
      <div className="text-center mb-12 animate-pulse">
        <div className="h-3 w-20 bg-gray-200 rounded mx-auto mb-3" />
        <div className="h-10 w-40 bg-gray-200 rounded mx-auto" />
      </div>

      {/* Product grid — 8 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square bg-gray-200 rounded-sm" />
            <div className="mt-3 space-y-2">
              <div className="h-2.5 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create PDP loading skeleton**

Create `app/(store)/shop/product/[id]/loading.tsx`:

```tsx
export default function ProductLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-12 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex gap-2 mb-8">
        <div className="h-3 w-8 bg-gray-200 rounded" />
        <div className="h-3 w-2 bg-gray-200 rounded" />
        <div className="h-3 w-16 bg-gray-200 rounded" />
        <div className="h-3 w-2 bg-gray-200 rounded" />
        <div className="h-3 w-28 bg-gray-200 rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 lg:gap-20">
        {/* Left — media gallery */}
        <div className="aspect-square bg-gray-200 rounded-sm" />

        {/* Right — product details */}
        <div className="space-y-6">
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
          <div className="h-16 w-full bg-gray-200 rounded" />
          <div className="h-px bg-gray-200" />
          <div className="space-y-3">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 w-24 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
          <div className="pt-4 space-y-3">
            <div className="h-14 w-full bg-gray-200 rounded" />
            <div className="h-12 w-full bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test skeletons in dev**

```bash
npm run dev
```

Open browser → navigate between shop and product pages → confirm shimmer appears instantly on each click. Check mobile view too (skeleton should stack single column on mobile).

- [ ] **Step 5: Commit**

```bash
git add app/\(store\)/shop/loading.tsx \
        app/\(store\)/shop/\[category\]/loading.tsx \
        app/\(store\)/shop/product/\[id\]/loading.tsx
git commit -m "feat: add loading skeletons for shop, category, and PDP routes"
```

---

## Task 1: Static Generation + ISR Shop Page

**Goal:** Pre-render all 23 PDP pages and 4 category pages as static HTML at build time; make `/shop` ISR with filter pills linking to static category pages.

**Files:**
- Modify: `app/(store)/shop/[category]/page.tsx`
- Modify: `app/(store)/shop/product/[id]/page.tsx`
- Modify: `app/(store)/shop/page.tsx`

**Acceptance Criteria:**
- [ ] `npm run build` output shows `/shop/rings`, `/shop/earrings`, `/shop/pendants`, `/shop/bracelets` marked as static (○)
- [ ] `npm run build` output shows all 23 `/shop/product/[id]` pages marked as static (○)
- [ ] `/shop` marked as ISR (ISR label or revalidate shown in build output)
- [ ] Filter pills on `/shop` navigate to `/shop/rings` not `?category=rings`
- [ ] No `searchParams` access in `shop/page.tsx`

**Verify:** `npm run build` → check build output table for route symbols

**Steps:**

- [ ] **Step 1: Add generateStaticParams to category page**

Open `app/(store)/shop/[category]/page.tsx`. Add after the imports, before `generateMetadata`:

```typescript
export const revalidate = 120

export async function generateStaticParams() {
  return ['rings', 'earrings', 'pendants', 'bracelets'].map((category) => ({ category }))
}
```

Remove the existing `export const revalidate = 60` line (replace with 120 above).

- [ ] **Step 2: Add generateStaticParams to PDP page**

Open `app/(store)/shop/product/[id]/page.tsx`. Add after the imports, before `generateMetadata`:

```typescript
export const revalidate = 120

export async function generateStaticParams() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true },
  })
  return products.map((p) => ({ id: p.id }))
}
```

Remove the existing `export const revalidate = 60` line.

- [ ] **Step 3: Rewrite shop page — remove searchParams**

Replace the full contents of `app/(store)/shop/page.tsx` with:

```tsx
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ProductCard from '@/components/store/ProductCard'

export const revalidate = 120

const FILTERS = [
  { label: 'All', href: '/shop' },
  { label: 'Rings', href: '/shop/rings' },
  { label: 'Earrings', href: '/shop/earrings' },
  { label: 'Pendants', href: '/shop/pendants' },
  { label: 'Bracelets', href: '/shop/bracelets' },
]

export default async function ShopPage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      itemCode: true,
      category: true,
      images: true,
      stoneType: true,
      caratWeight: true,
      comingSoon: true,
    },
  })

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-14">
      {/* Header */}
      <div className="text-center mb-12">
        <p className="text-xs text-brand-gold/60 tracking-[0.4em] uppercase mb-2">Collections</p>
        <h1 className="font-display text-3xl md:text-5xl text-gray-900">All</h1>
      </div>

      {/* Filters — link to static category pages */}
      <div className="flex flex-wrap justify-center gap-2 mb-12">
        {FILTERS.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="px-6 py-2 text-xs border tracking-[0.15em] uppercase transition-all border-gray-200 text-gray-600 hover:border-brand-gold hover:text-brand-gold"
          >
            {f.label}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-display text-3xl text-gray-300 mb-3">Coming Soon</p>
          <p className="text-sm text-gray-400">New pieces are being added to this collection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {products.map((p, i) => (
            <ProductCard
              key={p.id}
              id={p.id}
              name={p.name}
              itemCode={p.itemCode}
              category={p.category}
              images={p.images}
              stoneType={p.stoneType}
              caratWeight={p.caratWeight?.toString() ?? null}
              comingSoon={p.comingSoon}
              priority={i < 4}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

Note: "All" filter pill has no active state styling — it's always a plain link since this page always shows all products. Active state lives on the category pages.

- [ ] **Step 4: Add active state to category page filter pills**

In `app/(store)/shop/[category]/page.tsx`, the page currently has no filter pill bar. Add one that shows all categories with the current one highlighted. After the `generateStaticParams` function, the return JSX should include:

```tsx
// Add this FILTERS constant near the top of the file (after CATEGORY_MAP):
const FILTERS = [
  { label: 'All', href: '/shop' },
  { label: 'Rings', href: '/shop/rings' },
  { label: 'Earrings', href: '/shop/earrings' },
  { label: 'Pendants', href: '/shop/pendants' },
  { label: 'Bracelets', href: '/shop/bracelets' },
]
```

In the JSX return, replace the current header block with:

```tsx
<div className="text-center mb-12">
  <p className="text-xs text-brand-gold/60 tracking-[0.4em] uppercase mb-2">Collection</p>
  <h1 className="font-display text-3xl md:text-5xl text-gray-900">{label}</h1>
</div>

{/* Filter pills — same as shop page but with active state */}
<div className="flex flex-wrap justify-center gap-2 mb-12">
  {FILTERS.map((f) => {
    const active = f.href === `/shop/${category}`
    return (
      <Link
        key={f.href}
        href={f.href}
        className={`px-6 py-2 text-xs border tracking-[0.15em] uppercase transition-all ${
          active
            ? 'bg-brand-dark text-white border-brand-dark'
            : 'border-gray-200 text-gray-600 hover:border-brand-gold hover:text-brand-gold'
        }`}
      >
        {f.label}
      </Link>
    )
  })}
</div>
```

- [ ] **Step 5: Build and verify static generation**

```bash
npm run build
```

Expected output includes lines like:
```
○ /shop                          (ISR: 120 Seconds)
○ /shop/rings                    (Static)
○ /shop/earrings                 (Static)
○ /shop/pendants                 (Static)
○ /shop/bracelets                (Static)
○ /shop/product/[id]             (23 pages, Static)
```

If any route shows `λ` (lambda/dynamic) instead of `○` (static), that route still has a `searchParams`/`cookies`/`headers` read — investigate and remove it.

- [ ] **Step 6: Commit**

```bash
git add app/\(store\)/shop/page.tsx \
        app/\(store\)/shop/\[category\]/page.tsx \
        app/\(store\)/shop/product/\[id\]/page.tsx
git commit -m "perf: static generation for PDP + category pages, ISR shop page, unify filter pill routing"
```

---

## Task 2: Sharp Image Resize on Upload

**Goal:** Images resized to max 1200px and re-encoded as JPEG 85% before storing in Supabase; videos validated for 50MB limit and stored as-is.

**Files:**
- Modify: `app/api/admin/upload/route.ts`
- Modify: `package.json` (via npm install)

**Acceptance Criteria:**
- [ ] Uploading a 4000×4000px PNG → stored file is JPEG ≤ 1200px on longest side, ≤ 400KB
- [ ] Uploading a video under 50MB → stored as-is, returns `type: 'video'`
- [ ] Uploading a video over 50MB → 413 response with message
- [ ] Uploading an image that is already under 1200px → stored unchanged (not upscaled)
- [ ] Upload route still returns `{ url, type }` JSON — existing `ImageUploader` continues to work

**Verify:** Upload a large PNG from admin product form → check Supabase Storage dashboard for file size

**Steps:**

- [ ] **Step 1: Install Sharp**

```bash
npm install sharp
npm install --save-dev @types/sharp
```

Verify: `node -e "require('sharp'); console.log('ok')"` → prints `ok`

- [ ] **Step 2: Rewrite upload route**

Replace full contents of `app/api/admin/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'product-media'
const VIDEO_SIZE_LIMIT = 50 * 1024 * 1024 // 50MB — Supabase free tier cap

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
]

async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ALLOWED_TYPES,
    fileSizeLimit: VIDEO_SIZE_LIMIT,
  })
  if (error && !error.message.toLowerCase().includes('already exist')) throw error
}

export async function POST(req: NextRequest) {
  await requireAdmin()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported type: ${file.type}. Allowed: jpg/png/webp and mp4/webm/mov.` },
      { status: 400 }
    )
  }

  await ensureBucket()

  const isVideo = file.type.startsWith('video/')
  const arrayBuffer = await file.arrayBuffer()

  if (isVideo) {
    if (file.size > VIDEO_SIZE_LIMIT) {
      return NextResponse.json(
        { error: 'Video must be under 50MB. Use 720p, max 15 seconds.' },
        { status: 413 }
      )
    }

    const ext = file.name.split('.').pop() ?? 'mp4'
    const path = `products/videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, type: 'video' })
  }

  // Image — resize with Sharp
  const buffer = Buffer.from(arrayBuffer)
  const resized = await sharp(buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  const path = `products/images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, resized, { contentType: 'image/jpeg', upsert: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl, type: 'image' })
}
```

- [ ] **Step 3: Test locally**

```bash
npm run dev
```

Go to `/admin/products/new` → upload a large photo (e.g. iPhone photo, ~5MB) → check network tab response — `url` should point to a `.jpg` file. Open Supabase Storage dashboard → `product-media/products/images/` → verify new file is under 400KB.

Try uploading a video → confirm it uploads without Sharp processing.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/upload/route.ts package.json package-lock.json
git commit -m "feat: Sharp resize on image upload (max 1200px JPEG 85%), 50MB video limit"
```

---

## Task 3: Named Image Slots in ImageUploader

**Goal:** Replace free-form multi-upload with 5 named slots (Front · Left · Right · Back · Video) so image order is always enforced — array index 0 = front, 4 = video.

**Files:**
- Modify: `components/admin/ImageUploader.tsx`

**Acceptance Criteria:**
- [ ] Admin upload UI shows 5 labelled slots: Front, Left, Right, Back, Video
- [ ] Uploading to a slot places the URL at the correct array index
- [ ] Video slot only accepts video MIME types; image slots reject video
- [ ] Clicking a filled slot replaces it (not appends)
- [ ] Empty slots are excluded when saving (`images.filter(Boolean)` handled by parent — verify `ProductForm` passes through correctly)
- [ ] Existing products load their current images into the slots in array order

**Verify:** `npm run dev` → open admin product edit → confirm 5 slots render, upload to each, save product → check DB `images` array order in Supabase table editor

**Steps:**

- [ ] **Step 1: Rewrite ImageUploader**

Replace full contents of `components/admin/ImageUploader.tsx`:

```tsx
'use client'
import { useRef } from 'react'
import Image from 'next/image'

type Props = {
  images: string[]
  onChange: (images: string[]) => void
}

const SLOTS = [
  { label: 'Front', hint: 'Front view', accept: 'image/*', index: 0 },
  { label: 'Left', hint: 'Left side', accept: 'image/*', index: 1 },
  { label: 'Right', hint: 'Right side', accept: 'image/*', index: 2 },
  { label: 'Back', hint: 'Back view', accept: 'image/*', index: 3 },
  { label: 'Video', hint: 'Video (≤50MB)', accept: 'video/*', index: 4 },
]

function isVideo(url: string) {
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url)
}

export default function ImageUploader({ images, onChange }: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  async function uploadFile(file: File, slotIndex: number) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? 'Upload failed')
      return
    }
    const next = [...images]
    next[slotIndex] = json.url
    onChange(next)
  }

  function clearSlot(slotIndex: number) {
    const next = [...images]
    next[slotIndex] = ''
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-3">
        {SLOTS.map((slot) => {
          const url = images[slot.index] ?? ''
          const filled = !!url

          return (
            <div key={slot.label} className="space-y-1">
              <p className="text-[10px] text-gray-500 tracking-widest uppercase text-center">
                {slot.label}
              </p>

              <div className="relative aspect-square group">
                {filled ? (
                  <>
                    {isVideo(url) ? (
                      <video
                        src={url}
                        className="w-full h-full object-cover rounded border border-gray-200"
                        muted
                        playsInline
                      />
                    ) : (
                      <Image
                        src={url}
                        alt={slot.label}
                        fill
                        className="object-cover rounded border border-gray-200"
                      />
                    )}
                    {isVideo(url) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px]">▶</span>
                      </div>
                    )}
                    {/* Replace on click */}
                    <button
                      type="button"
                      onClick={() => inputRefs.current[slot.index]?.click()}
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity rounded flex items-center justify-center"
                      title="Replace"
                    >
                      <span className="text-white text-xs">Replace</span>
                    </button>
                    {/* Clear */}
                    <button
                      type="button"
                      onClick={() => clearSlot(slot.index)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputRefs.current[slot.index]?.click()}
                    className="w-full h-full border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-colors"
                  >
                    <span className="text-xl leading-none">+</span>
                    <span className="text-[9px] mt-1 text-center leading-tight px-1">{slot.hint}</span>
                  </button>
                )}

                <input
                  ref={(el) => { inputRefs.current[slot.index] = el }}
                  type="file"
                  accept={slot.accept}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadFile(file, slot.index)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-gray-400">
        Images: jpg · png · webp — max 1200px (auto-resized) &nbsp;·&nbsp; Video: mp4 · mov — max 50MB · 720p · 15s
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Verify ProductForm passes images through correctly**

Open `components/admin/ProductForm.tsx`. Find where `ImageUploader` is used and where the `images` array is submitted. Confirm the parent passes `images` state as-is to the API (no filtering needed — the upload route and DB accept sparse arrays; empty strings at unused slots are fine since `MediaGallery` uses `isVideo` and truthy checks).

If the product API (`app/api/admin/products/route.ts` or `[id]/route.ts`) saves `images` directly to Prisma, no change needed — Prisma stores the array as-is.

- [ ] **Step 3: Test in dev**

```bash
npm run dev
```

Go to `/admin/products/new`:
- Confirm 5 slots render labelled Front/Left/Right/Back/Video
- Upload an image to Front slot → confirm thumbnail appears in position 0
- Upload a video to Video slot → confirm it accepts only video files
- Try uploading a video to Front slot → browser file picker should restrict to images only (due to `accept="image/*"`)
- Save product → check Supabase table editor → `images` column array has URL at index 0, others empty or populated in order

Go to `/admin/products/[existing-id]/edit`:
- Confirm existing images load into slots in current array order

- [ ] **Step 4: Commit**

```bash
git add components/admin/ImageUploader.tsx
git commit -m "feat: named image slots in admin uploader (Front/Left/Right/Back/Video)"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Loading skeletons for shop, category, PDP → Task 0
- [x] generateStaticParams for PDP (23 products) → Task 1
- [x] generateStaticParams for categories (4) → Task 1
- [x] ISR shop page, remove searchParams → Task 1
- [x] Filter pills unified to /shop/[category] → Task 1
- [x] Sharp resize pipeline → Task 2
- [x] 50MB video limit → Task 2
- [x] Named image slots → Task 3
- [x] Video slot separate from image slots → Task 3

**No placeholders:** All steps have complete code. ✓

**Type consistency:** `images: string[]` interface on `ImageUploader` unchanged. Upload route returns `{ url: string, type: 'image' | 'video' }` unchanged. ✓
