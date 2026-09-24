# Admin UI Overhaul Phase 2 — Design

## Goal

Two independent fixes to the admin panel (`app/(admin)/admin/*`), rolled out together page-by-page:

1. **Responsive fix** — tables and grids that break/scroll awkwardly on mobile get a proper mobile layout.
2. **Guide section** — every top-level admin section gets a short, collapsible help box explaining what it does and any gotchas.

## Background

Phase 1 (already shipped) restyled admin pages off dead Tailwind classes onto the existing design system: `styles/pages/admin-shell.css` (shared page chrome: `.admin-page`, `.admin-page__header`, `.admin-stats`/`.admin-stat-card`, `.admin-panel`, `.admin-btn`, `.admin-table-wrap`) and `styles/pages/admin-form.css` (`.pform` — the ProductForm's own scoped grid system). `catalogue/comments` (list + detail) was the last page fixed in that pass.

This phase doesn't touch styling correctness (phase 1's job) — it adds mobile layouts and a new help-content layer.

## Scope

**11 top-level sections** (from `app/(admin)/AdminSidebar.tsx`'s `NAV` array) get the guide box:

Dashboard, Analytics, Products, Orders, Content, Collections, Home Sections, Pricing, Promos, Reviews, Contacts.

**Excluded** — these are actions *within* a section, not sections themselves; no guide box:
`orders/[id]` (order detail), `orders/new` (manual order), `products/new`, `products/[id]/edit`, `catalogue/comments` (+ `[productId]`).

Responsive fixes apply wherever the underlying problem exists (see Part 2), which includes some of the excluded pages (e.g. `orders/[id]` has a fixed 2-col grid).

## Part 1: `AdminGuide` component

New file: `components/admin/AdminGuide.tsx` — client component (`'use client'`), same "island inside a server-rendered page" pattern already used by `ContactStatusButtons`, `CollectionsManager`, etc.

```tsx
type AdminGuideProps = {
  pageKey: string       // e.g. 'dashboard', 'orders' — used as the localStorage key suffix
  title: string
  blurb: string
  tips?: string[]
}
```

Behavior:
- Local state `collapsed`, initialized `false`.
- On mount (`useEffect`), read `localStorage.getItem('admin-guide:' + pageKey)`; if `'1'`, set `collapsed(true)`. This causes a one-frame expanded→collapsed flash for returning users who collapsed it — same trade-off `AdminSidebar`'s drawer state already accepts elsewhere in this codebase, not a new pattern.
- Toggle button flips `collapsed` and writes `'1'`/`'0'` to the same localStorage key.
- Renders (expanded): eyebrow text "GUIDE", `title`, `blurb` as a paragraph, `tips` (if present) as a bullet list, a toggle button (chevron, rotates on state).
- Renders (collapsed): just the title bar + toggle button, no blurb/tips.

CSS: new block appended to `styles/pages/admin-shell.css`:
```
.admin-guide { background: #fdf8f0; border: 1px solid #e8d5a8; border-left: 3px solid #b8963e; border-radius: 8px; padding: 0.9rem 1.1rem; margin-bottom: 1.5rem; }
.admin-guide__head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; cursor: pointer; }
.admin-guide__eyebrow { font-size: 0.625rem; letter-spacing: 0.1em; text-transform: uppercase; color: #b8963e; font-weight: 600; margin: 0 0 2px; }
.admin-guide__title { font-size: 0.9375rem; font-weight: 600; color: #111827; margin: 0; }
.admin-guide__toggle { border: none; background: transparent; cursor: pointer; color: #6b7280; padding: 4px; }
.admin-guide__body { margin-top: 0.6rem; font-size: 0.8125rem; color: #4b5563; line-height: 1.5; }
.admin-guide__tips { margin: 0.5rem 0 0; padding-left: 1.1rem; }
.admin-guide__tips li { margin-bottom: 0.25rem; }
```
(Gold-accented left border distinguishes it from the neutral `.admin-panel` content blocks.)

Placement: rendered as the first element inside `.admin-page`, immediately after `.admin-page__header` (or after the title if a page has no `__header` wrapper), before stats/content.

## Part 2: Responsive fixes

### A) Tables → mobile card fallback

Currently these tables use a fixed `minWidth` (px) inside `.admin-table-wrap`, which just horizontal-scrolls on phone — inconsistent with `admin/products` (which already has a proper card view below 768px via `.admin-products__cards`/`.admin-products__table-wrap`).

New **generic** (not page-prefixed) block in `admin-shell.css` — these 5 tables are structurally identical (thumb + name/meta + 2-3 numeric columns), so one shared block avoids near-duplicate CSS 5 times over:

```
.admin-cards { display: flex; flex-direction: column; gap: 10px; list-style: none; margin: 0; padding: 0; }
.admin-card { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
.admin-card__media { position: relative; width: 48px; height: 48px; border-radius: 6px; overflow: hidden; background: #050505; flex-shrink: 0; }
.admin-card__body { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.admin-card__title { font-weight: 500; font-size: 0.875rem; color: #111827; }
.admin-card__meta { font-size: 0.75rem; color: #6b7280; margin: 0; }

@media (max-width: 767px) {
  .admin-table-wrap { display: none; }
}
@media (min-width: 768px) {
  .admin-cards { display: none; }
}
```

Files (add a `.admin-cards` list rendered alongside the existing `.admin-table-wrap` table, same data, each hidden at the opposite breakpoint):
- `app/(admin)/admin/orders/page.tsx` — 1 table
- `app/(admin)/admin/catalogue/comments/page.tsx` — 2 tables (feedback + all-products)
- `app/(admin)/admin/catalogue/comments/[productId]/page.tsx` — 2 tables (comments + reactions)

### B) Fixed grids → responsive

Currently `style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}` (or `'1fr 1fr 1fr'`) — inline styles can't hold a media query, so these never collapse to 1 column on phone.

New utility classes in `admin-shell.css`, same breakpoint `.pform__grid--3` already uses:
```
.admin-grid-2 { display: grid; grid-template-columns: 1fr; gap: 10px; }
.admin-grid-3 { display: grid; grid-template-columns: 1fr; gap: 8px; }
@media (min-width: 640px) {
  .admin-grid-2 { grid-template-columns: 1fr 1fr; }
  .admin-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
}
```

Replace inline `style={{display:'grid', gridTemplateColumns:...}}` with `className="admin-grid-2"` (or `-3`) at:
- `app/(admin)/admin/sections/SectionsManager.tsx` — lines 111, 148 (both `1fr 1fr`)
- `app/(admin)/admin/collections/CollectionsManager.tsx` — line 65 (`1fr 1fr`)
- `app/(admin)/admin/orders/new/ManualOrderForm.tsx` — line 362 (`1fr 1fr 1fr`)
- `app/(admin)/admin/orders/[id]/page.tsx` — line 165 (`1fr 1fr`)

(`analytics/page.tsx`'s `140px 1fr 60px` grid and `PromosManager`'s `repeat(auto-fit, minmax(120px,1fr))` are left as-is — both already degrade acceptably on a 375px screen; not in scope.)

## Part 3: Guide copy (final text, all 11 sections)

| pageKey | title | blurb | tips |
|---|---|---|---|
| `dashboard` | Dashboard | At-a-glance store health — orders, revenue, low stock. | Numbers refresh on page load, not live. |
| `analytics` | Analytics | Traffic, conversion funnel, top products from first-party + GA4. | First-party data only; GA4 numbers may lag by a day. |
| `products` | Products | Full catalogue CRUD — draft, AI-draft, or live. | Only **live** products show on the storefront. · Image order (front→left→right→back) controls PDP gallery order. |
| `orders` | Orders | Full order list + lifecycle (payment → delivery → returns/RTO). Manual Order creates one on a customer's behalf. | Status changes here can trigger customer emails — double-check before changing. |
| `content` | Content | Homepage/PLP hero banners + category headline text. | Changes go live immediately — no draft/preview beyond the built-in preview pane. |
| `collections` | Collections | Curated product groupings shown on collection pages. | A product can belong to multiple collections. |
| `sections` | Home Sections | Homepage feature blocks (collection rail, editorial, video, USP) — order + schedule them. | `startsAt`/`endsAt` let you schedule a section without deleting it; inactive sections are hidden, not deleted. |
| `pricing` | Pricing | Gold rate, Value-Addition %, making charges, diamond rates — feeds the live pricing formula. | Changes apply to **new** price calculations only — existing orders keep their locked-in price. |
| `promos` | Promos | Create/disable promo codes, track redemptions. | Disabling a code doesn't refund carts that already applied it. |
| `reviews` | Reviews | Moderate customer reviews before they go public. | Unapproved reviews are invisible on the storefront — nothing auto-publishes. |
| `contacts` | Contacts | Inbox for the storefront contact form. | No reply-from-here — copy the email/phone and respond externally. |

Tips with a `·` separator become separate `<li>` items.

## Rollout

Together, page by page: each of the 11 section pages gets its `<AdminGuide>` insertion in the same commit as its responsive fix (where one applies). Pages with no table/grid issue (Dashboard, Analytics, Content, Promos, Reviews, Contacts, Pricing) only get the guide box. `orders/[id]`, `orders/new`, `products/new`, `products/[id]/edit`, `catalogue/comments` (+ `[productId]`) only get responsive fixes where applicable, no guide box.

## Testing

- `npx tsc --noEmit` — no type errors.
- `npx eslint` on every touched file — zero findings (matches phase 1 bar).
- Manual browser check per touched page: resize to 375px width — grids stack to 1 column, tables give way to card list, guide box collapses/expands and survives a page reload (localStorage).
- No automated test suite exists for admin pages currently (none added — matches existing coverage level, out of scope to introduce one here).

## Out of scope

- Guide content editable via CMS/DB (static copy only, per design discussion).
- Responsive fixes for `analytics` and `promos`'s already-adequate grids.
- Any change to `catalogue/comments` styling beyond adding the table/card responsive split (phase 1 already restyled it off Tailwind).
- Legacy orphaned routes `app/(admin)/dashboard`, `app/(admin)/products*` (unreferenced by `AdminSidebar`, dead code — not touched).
