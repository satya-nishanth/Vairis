# Admin UI Overhaul Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible guide/help box to all 11 top-level admin sections, and fix mobile layout for the tables/grids that currently break on phone.

**Architecture:** One new client component (`AdminGuide`) reused across 11 pages with per-page copy props. Three new CSS blocks in the existing `styles/pages/admin-shell.css` (guide box, generic mobile card list, responsive grid utilities) — no new stylesheets, matches how every other admin page-chrome class already lives in that one file. Tables get a `.admin-cards` mobile-only sibling next to the existing `.admin-table-wrap`; fixed inline-style grids get swapped for the new utility classes so they can carry a media query (inline styles can't).

**Tech Stack:** Next.js 16 App Router (server components + `'use client'` islands), no Tailwind (removed project-wide — plain CSS + inline `style={{}}`), Prisma 5.

Full design rationale: `docs/superpowers/specs/2026-08-11-admin-ui-overhaul-phase2-design.md`.

---

### Task 1: `AdminGuide` component + CSS foundation

**Goal:** One reusable collapsible guide component, plus all three new CSS blocks this plan needs (guide box, mobile card list, responsive grid utilities), so every later task just consumes them.

**Files:**
- Create: `components/admin/AdminGuide.tsx`
- Modify: `styles/pages/admin-shell.css` (append at end of file, after the existing `@media (min-width: 768px)` block that currently ends the file at line 1447)

**Acceptance Criteria:**
- [ ] `<AdminGuide pageKey="x" title="..." blurb="..." tips={[...]} />` renders an expanded box by default
- [ ] Clicking the header collapses it (blurb/tips hidden, title bar stays)
- [ ] Collapsed state persists across a page reload via `localStorage['admin-guide:x']`
- [ ] `.admin-cards`/`.admin-table-wrap` show/hide correctly at the 768px breakpoint
- [ ] `.admin-grid-2`/`.admin-grid-3` stack to 1 column below 640px, 2/3 columns at/above it

**Verify:** `npx tsc --noEmit` → no errors. `npx eslint components/admin/AdminGuide.tsx` → zero findings.

**Steps:**

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useEffect, useState } from 'react'

type AdminGuideProps = {
  pageKey: string
  title: string
  blurb: string
  tips?: string[]
}

export function AdminGuide({ pageKey, title, blurb, tips }: AdminGuideProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(`admin-guide:${pageKey}`) === '1') {
      setCollapsed(true)
    }
  }, [pageKey])

  function toggle() {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(`admin-guide:${pageKey}`, next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="admin-guide">
      <button type="button" className="admin-guide__head" onClick={toggle} aria-expanded={!collapsed}>
        <span>
          <span className="admin-guide__eyebrow">Guide</span>
          <span className="admin-guide__title">{title}</span>
        </span>
        <span className="admin-guide__toggle" aria-hidden="true">{collapsed ? '▾' : '▴'}</span>
      </button>
      {!collapsed && (
        <div className="admin-guide__body">
          <p style={{ margin: 0 }}>{blurb}</p>
          {tips && tips.length > 0 && (
            <ul className="admin-guide__tips">
              {tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Append CSS to `styles/pages/admin-shell.css`**

Add this block at the end of the file (after the last `}` closing the `@media (min-width: 768px)` rule):

```css

/* —— Admin section guide box (phase 2) —— */
.admin-guide {
  background: #fdf8f0;
  border: 1px solid #e8d5a8;
  border-left: 3px solid #b8963e;
  border-radius: 8px;
  padding: 0.9rem 1.1rem;
  margin-bottom: 1.5rem;
}

.admin-guide__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
}

.admin-guide__eyebrow {
  display: block;
  font-size: 0.625rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #b8963e;
  font-weight: 600;
  margin: 0 0 2px;
}

.admin-guide__title {
  display: block;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.admin-guide__toggle {
  flex-shrink: 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.admin-guide__body {
  margin-top: 0.6rem;
  font-size: 0.8125rem;
  color: #4b5563;
  line-height: 1.5;
}

.admin-guide__tips {
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
}

.admin-guide__tips li {
  margin-bottom: 0.25rem;
}

/* —— Generic mobile card list (phase 2) —— */
/* Pairs with .admin-table-wrap: table hidden <768px, cards hidden >=768px.
   Content-agnostic (unlike .admin-products__* which is products-specific) —
   reused by orders + catalogue/comments, which all share the same
   thumb/name/meta-lines shape. */
.admin-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.admin-card {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
}

.admin-card--no-media {
  grid-template-columns: 1fr;
}

.admin-card__media {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  background: #050505;
  flex-shrink: 0;
}

.admin-card__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-card__title {
  font-weight: 500;
  font-size: 0.875rem;
  color: #111827;
}

.admin-card__meta {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
}

@media (max-width: 767px) {
  .admin-table-wrap {
    display: none;
  }
}

@media (min-width: 768px) {
  .admin-cards {
    display: none;
  }
}

/* —— Responsive grid utilities (phase 2) —— */
/* Replaces inline style={{display:'grid', gridTemplateColumns:...}} at fixed
   column counts (which can't hold a media query) with a class that stacks to
   1 column on mobile. Same 640px breakpoint .pform__grid--3 already uses. */
.admin-grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.admin-grid-3 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

@media (min-width: 640px) {
  .admin-grid-2 {
    grid-template-columns: 1fr 1fr;
  }

  .admin-grid-3 {
    grid-template-columns: 1fr 1fr 1fr;
  }
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npx eslint components/admin/AdminGuide.tsx`
Expected: zero findings.

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminGuide.tsx styles/pages/admin-shell.css
git commit -m "Add AdminGuide component + responsive CSS foundation for admin UI phase 2"
```

---

### Task 2: Dashboard — guide box

**Goal:** Dashboard gets its guide box. No responsive issue on this page (stats grid already uses `.admin-stats`, which is responsive).

**Files:**
- Modify: `app/(admin)/admin/dashboard/page.tsx`

**Acceptance Criteria:**
- [ ] Guide box renders between the title and the stats grid
- [ ] Collapsed/expanded state persists across reload

**Verify:** `npx tsc --noEmit && npx eslint "app/(admin)/admin/dashboard/page.tsx"` → clean.

**Steps:**

- [ ] **Step 1: Import `AdminGuide` and insert it**

Add the import near the top of `app/(admin)/admin/dashboard/page.tsx` (alongside the other imports):

```tsx
import { AdminGuide } from '@/components/admin/AdminGuide'
```

Then change:

```tsx
    <div className="admin-page">
      <h1 className="admin-page__title">Dashboard</h1>

      <div className="admin-stats">
```

to:

```tsx
    <div className="admin-page">
      <h1 className="admin-page__title">Dashboard</h1>
      <AdminGuide
        pageKey="dashboard"
        title="Dashboard"
        blurb="At-a-glance store health — orders, revenue, low stock."
        tips={['Numbers refresh on page load, not live.']}
      />

      <div className="admin-stats">
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/dashboard/page.tsx"
git commit -m "Add guide box to admin Dashboard"
```

---

### Task 3: Analytics — guide box

**Goal:** Analytics gets its guide box. No responsive issue (its grids already use `auto-fit`/fit within a 375px viewport).

**Files:**
- Modify: `app/(admin)/admin/analytics/page.tsx`

**Acceptance Criteria:**
- [ ] Guide box renders between the title and the stats grid

**Verify:** `npx tsc --noEmit && npx eslint "app/(admin)/admin/analytics/page.tsx"` → clean.

**Steps:**

- [ ] **Step 1: Import and insert**

Add near the top:

```tsx
import { AdminGuide } from '@/components/admin/AdminGuide'
```

Change:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '1.5rem' }}>
        Analytics
      </h1>

      <div className="admin-stats">
```

to:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '1.5rem' }}>
        Analytics
      </h1>
      <AdminGuide
        pageKey="analytics"
        title="Analytics"
        blurb="Traffic, conversion funnel, top products from first-party + GA4."
        tips={['First-party data only; GA4 numbers may lag by a day.']}
      />

      <div className="admin-stats">
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/analytics/page.tsx"
git commit -m "Add guide box to admin Analytics"
```

---

### Task 4: Products — guide box

**Goal:** Products list gets its guide box. Already responsive (phase 1 gave it card/table split) — no layout fix needed here.

**Files:**
- Modify: `app/(admin)/admin/products/page.tsx`

**Acceptance Criteria:**
- [ ] Guide box renders after the header (title + "+ New Product" button), before the category tabs

**Verify:** `npx tsc --noEmit && npx eslint "app/(admin)/admin/products/page.tsx"` → clean.

**Steps:**

- [ ] **Step 1: Import and insert**

Add near the top:

```tsx
import { AdminGuide } from '@/components/admin/AdminGuide'
```

Change:

```tsx
        <Link href={newProductHref} className="admin-btn">
          + New Product
        </Link>
      </div>

      <div className="admin-products__filters">
```

to:

```tsx
        <Link href={newProductHref} className="admin-btn">
          + New Product
        </Link>
      </div>
      <AdminGuide
        pageKey="products"
        title="Products"
        blurb="Full catalogue CRUD — draft, AI-draft, or live."
        tips={[
          'Only live products show on the storefront.',
          'Image order (front→left→right→back) controls PDP gallery order.',
        ]}
      />

      <div className="admin-products__filters">
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/products/page.tsx"
git commit -m "Add guide box to admin Products"
```

---

### Task 5: Orders — guide box + mobile card fallback

**Goal:** Orders list gets its guide box, and its table gets a mobile card view (currently just horizontal-scrolls on phone).

**Files:**
- Modify: `app/(admin)/admin/orders/page.tsx`

**Acceptance Criteria:**
- [ ] Guide box renders after the header, before the "database migration required" warning / filter chips
- [ ] Below 768px, a card list shows instead of the table (same data, same fields: order id, customer, items, paid/deposit, status, date)
- [ ] At/above 768px, the table shows and the card list is hidden

**Verify:** `npx tsc --noEmit && npx eslint "app/(admin)/admin/orders/page.tsx"` → clean. Manual: resize browser to 375px, confirm cards render; resize to 1024px, confirm table renders.

**Steps:**

- [ ] **Step 1: Import `AdminGuide` and insert the guide box**

Add near the top:

```tsx
import { AdminGuide } from '@/components/admin/AdminGuide'
```

Change:

```tsx
      <div className="admin-page__header">
        <h1 className="admin-page__title" style={{ marginBottom: 0 }}>Orders</h1>
        <Link href="/admin/orders/new" className="admin-btn">
          + Manual Order
        </Link>
      </div>

      {dbMissing && (
```

to:

```tsx
      <div className="admin-page__header">
        <h1 className="admin-page__title" style={{ marginBottom: 0 }}>Orders</h1>
        <Link href="/admin/orders/new" className="admin-btn">
          + Manual Order
        </Link>
      </div>
      <AdminGuide
        pageKey="orders"
        title="Orders"
        blurb="Full order list + lifecycle (payment → delivery → returns/RTO). Manual Order creates one on a customer's behalf."
        tips={['Status changes here can trigger customer emails — double-check before changing.']}
      />

      {dbMissing && (
```

- [ ] **Step 2: Add the mobile card list next to the table**

Change:

```tsx
      {dbMissing ? null : orders.length === 0 ? (
        <p style={{ color: '#6b7280', padding: '2rem 0' }}>No orders{filter ? ` in ${filter}` : ' yet'}.</p>
      ) : (
        <div className="admin-table-wrap">
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', background: '#fff', fontSize: '0.8125rem' }}>
```

to:

```tsx
      {dbMissing ? null : orders.length === 0 ? (
        <p style={{ color: '#6b7280', padding: '2rem 0' }}>No orders{filter ? ` in ${filter}` : ' yet'}.</p>
      ) : (
        <>
        <ul className="admin-cards">
          {orders.map((order) => (
            <li key={order.id} className="admin-card admin-card--no-media">
              <div className="admin-card__body">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <Link href={`/admin/orders/${order.id}`} className="admin-card__title" style={{ color: '#032b24', textDecoration: 'none' }}>
                    {order.id.slice(-8)}
                  </Link>
                  <span className="admin-card__meta">
                    {order.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <p className="admin-card__meta">{order.user.email}</p>
                <p className="admin-card__meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {order.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ')}
                </p>
                <p className="admin-card__meta">
                  {ORDER_STATUS_META[order.status]?.label ?? order.status}
                  {' · '}Paid {inr(order.grandTotal)}
                  {' · '}Deposit {Number(order.payment?.refundedAmount ?? 0) > 0 ? '↩ ' : ''}{inr(order.depositAmount)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="admin-table-wrap">
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', background: '#fff', fontSize: '0.8125rem' }}>
```

Then change the closing (currently `</table>\n        </div>\n      )}`) to close the new fragment too:

```tsx
        </table>
        </div>
        </>
      )}
```

(That replaces the existing:)

```tsx
        </table>
        </div>
      )}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors (note `ORDER_STATUS_META` and `inr` are already in scope in this file — no new imports needed).

Manual: `npm run dev`, open `/admin/orders`, resize to 375px width — card list shows, no horizontal scroll. Resize to 1024px — table shows.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/orders/page.tsx"
git commit -m "Add guide box + mobile card fallback to admin Orders list"
```

---

### Task 6: Content — guide box

**Goal:** Content (site banners/headlines) gets its guide box, replacing its existing static intro paragraph (folding that paragraph's actual info into the guide's tips instead of losing it).

**Files:**
- Modify: `app/(admin)/admin/content/page.tsx`

**Acceptance Criteria:**
- [ ] Guide box replaces the old intro `<p>`, no duplicate messaging
- [ ] The "click Edit to open the full page with live preview" tip is preserved

**Verify:** `npx tsc --noEmit && npx eslint "app/(admin)/admin/content/page.tsx"` → clean.

**Steps:**

- [ ] **Step 1: Import, replace intro paragraph with guide box**

Add near the top:

```tsx
import { AdminGuide } from '@/components/admin/AdminGuide'
```

Change:

```tsx
      <h1 className="admin-page__title">Site Content</h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1.5rem', maxWidth: 640 }}>
        Edit category and home heroes. Click <strong>Edit</strong> to open the full page with live
        storefront preview.
      </p>
```

to:

```tsx
      <h1 className="admin-page__title">Site Content</h1>
      <AdminGuide
        pageKey="content"
        title="Content"
        blurb="Homepage/PLP hero banners + category headline text."
        tips={[
          'Click Edit to open the full page with live storefront preview.',
          'Changes go live immediately — no draft/preview beyond the built-in preview pane.',
        ]}
      />
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/content/page.tsx"
git commit -m "Add guide box to admin Content"
```

---

### Task 7: Collections — guide box + responsive grid

**Goal:** Collections gets its guide box (replacing its existing intro paragraph, folding its info into tips), and `CollectionsManager`'s fixed 2-col form grid becomes responsive.

**Files:**
- Modify: `app/(admin)/admin/collections/page.tsx`
- Modify: `app/(admin)/admin/collections/CollectionsManager.tsx:65`

**Acceptance Criteria:**
- [ ] Guide box replaces the old intro paragraph
- [ ] Collection form's 2-col grid stacks to 1 column below 640px

**Verify:** `npx tsc --noEmit && npx eslint "app/(admin)/admin/collections/page.tsx" "app/(admin)/admin/collections/CollectionsManager.tsx"` → clean.

**Steps:**

- [ ] **Step 1: Import, replace intro paragraph in `page.tsx`**

Add near the top of `app/(admin)/admin/collections/page.tsx`:

```tsx
import { AdminGuide } from '@/components/admin/AdminGuide'
```

Change:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Collections
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        Curated product edits with their own landing page (/collections/slug).
        &ldquo;Show in nav&rdquo; pins the collection into the storefront header.
        Attach a collection rail to the home page from Content → Home Sections.
      </p>
```

to:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Collections
      </h1>
      <AdminGuide
        pageKey="collections"
        title="Collections"
        blurb="Curated product groupings shown on collection pages (/collections/slug)."
        tips={[
          '"Show in nav" pins the collection into the storefront header.',
          'A product can belong to multiple collections.',
          'Attach a collection rail to the home page from Home Sections.',
        ]}
      />
```

- [ ] **Step 2: Fix the grid in `CollectionsManager.tsx`**

Change (line 65):

```tsx
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
```

to:

```tsx
      <div className="admin-grid-2">
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/collections/page.tsx" "app/(admin)/admin/collections/CollectionsManager.tsx"
git commit -m "Add guide box + responsive form grid to admin Collections"
```

---

### Task 8: Home Sections — guide box + responsive grids

**Goal:** Home Sections gets its guide box (folding its existing intro info into tips), and `SectionsManager`'s two fixed 2-col grids become responsive.

**Files:**
- Modify: `app/(admin)/admin/sections/page.tsx`
- Modify: `app/(admin)/admin/sections/SectionsManager.tsx:111,148`

**Acceptance Criteria:**
- [ ] Guide box replaces the old intro paragraph
- [ ] Both form grids in `SectionsManager` stack to 1 column below 640px

**Verify:** `npx tsc --noEmit && npx eslint "app/(admin)/admin/sections/page.tsx" "app/(admin)/admin/sections/SectionsManager.tsx"` → clean.

**Steps:**

- [ ] **Step 1: Import, replace intro paragraph in `page.tsx`**

Add near the top of `app/(admin)/admin/sections/page.tsx`:

```tsx
import { AdminGuide } from '@/components/admin/AdminGuide'
```

Change:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Home Sections
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        Ordered blocks rendered on the home page below the hero. Schedule with
        start/end dates for launches and festive edits. No sections = the
        built-in home layout, unchanged.
      </p>
```

to:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Home Sections
      </h1>
      <AdminGuide
        pageKey="sections"
        title="Home Sections"
        blurb="Homepage feature blocks (collection rail, editorial, video, USP) — order + schedule them."
        tips={[
          'startsAt/endsAt let you schedule a section without deleting it — inactive sections are hidden, not deleted.',
          'No sections configured = the built-in home layout is used, unchanged.',
        ]}
      />
```

- [ ] **Step 2: Fix both grids in `SectionsManager.tsx`**

Change (line 111):

```tsx
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
            Section type
```

to:

```tsx
        <div className="admin-grid-2">
          <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
            Section type
```

Change (line 148):

```tsx
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
            Title (optional)
```

to:

```tsx
        <div className="admin-grid-2">
          <label style={{ fontSize: '0.75rem', display: 'grid', gap: 4 }}>
            Title (optional)
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/sections/page.tsx" "app/(admin)/admin/sections/SectionsManager.tsx"
git commit -m "Add guide box + responsive form grids to admin Home Sections"
```

---

### Task 9: Pricing — guide box

**Goal:** Pricing Settings gets its guide box (folding its existing intro info into tips). `PricingSettingsForm`'s own `.pform__grid` classes are already responsive (phase 1) — no grid fix needed here.

**Files:**
- Modify: `app/(admin)/admin/settings/pricing/page.tsx`

**Acceptance Criteria:**
- [ ] Guide box replaces the old intro paragraph

**Verify:** `npx tsc --noEmit && npx eslint "app/(admin)/admin/settings/pricing/page.tsx"` → clean.

**Steps:**

- [ ] **Step 1: Import, replace intro paragraph**

Add near the top:

```tsx
import { AdminGuide } from '@/components/admin/AdminGuide'
```

Change:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Pricing Settings
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        Value Addition is shown as its own line on every customer price breakup
        (PDP, checkout, invoice). Diamond rates are per carat — customers choose
        with-exchange or without-exchange pricing on the product page.
      </p>
```

to:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Pricing Settings
      </h1>
      <AdminGuide
        pageKey="pricing"
        title="Pricing"
        blurb="Gold rate, Value-Addition %, making charges, diamond rates — feeds the live pricing formula."
        tips={[
          'Changes apply to new price calculations only — existing orders keep their locked-in price.',
          'Diamond rates are per carat; customers choose with-exchange or without-exchange pricing on the product page.',
        ]}
      />
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/settings/pricing/page.tsx"
git commit -m "Add guide box to admin Pricing Settings"
```

---

### Task 10: Promos — guide box

**Goal:** Promos gets its guide box (folding its existing intro info into tips). `PromosManager`'s grid already uses `repeat(auto-fit, minmax(120px,1fr))` — already responsive, no fix needed.

**Files:**
- Modify: `app/(admin)/admin/promos/page.tsx`

**Acceptance Criteria:**
- [ ] Guide box replaces the old intro paragraph

**Verify:** `npx tsc --noEmit && npx eslint "app/(admin)/admin/promos/page.tsx"` → clean.

**Steps:**

- [ ] **Step 1: Import, replace intro paragraph**

Add near the top:

```tsx
import { AdminGuide } from '@/components/admin/AdminGuide'
```

Change:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Promo Codes
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        Percent or flat discounts applied at checkout. Codes with redemptions are
        deactivated instead of deleted so order history stays intact.
      </p>
```

to:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Promo Codes
      </h1>
      <AdminGuide
        pageKey="promos"
        title="Promos"
        blurb="Create/disable promo codes, track redemptions."
        tips={[
          "Disabling a code doesn't refund carts that already applied it.",
          'Codes with redemptions are deactivated instead of deleted, so order history stays intact.',
        ]}
      />
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/promos/page.tsx"
git commit -m "Add guide box to admin Promos"
```

---

### Task 11: Reviews — guide box

**Goal:** Reviews gets its guide box (folding its existing intro info into tips).

**Files:**
- Modify: `app/(admin)/admin/reviews/page.tsx`

**Acceptance Criteria:**
- [ ] Guide box replaces the old intro paragraph

**Verify:** `npx tsc --noEmit && npx eslint "app/(admin)/admin/reviews/page.tsx"` → clean.

**Steps:**

- [ ] **Step 1: Import, replace intro paragraph**

Add near the top:

```tsx
import { AdminGuide } from '@/components/admin/AdminGuide'
```

Change:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Reviews
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        New reviews are hidden until approved. Verified = reviewer has a delivered
        order containing the piece.
      </p>
```

to:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Reviews
      </h1>
      <AdminGuide
        pageKey="reviews"
        title="Reviews"
        blurb="Moderate customer reviews before they go public."
        tips={[
          'Unapproved reviews are invisible on the storefront — nothing auto-publishes.',
          'Verified = reviewer has a delivered order containing the piece.',
        ]}
      />
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/reviews/page.tsx"
git commit -m "Add guide box to admin Reviews"
```

---

### Task 12: Contacts — guide box

**Goal:** Contacts gets its guide box. No existing intro paragraph to fold in — use the spec's blurb/tips as-is.

**Files:**
- Modify: `app/(admin)/admin/contacts/page.tsx`

**Acceptance Criteria:**
- [ ] Guide box renders between the title and the request list

**Verify:** `npx tsc --noEmit && npx eslint "app/(admin)/admin/contacts/page.tsx"` → clean.

**Steps:**

- [ ] **Step 1: Import and insert**

Add near the top:

```tsx
import { AdminGuide } from '@/components/admin/AdminGuide'
```

Change:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '1.5rem' }}>
        Contact Requests
      </h1>
      <div style={{ display: 'grid', gap: 12 }}>
```

to:

```tsx
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '1.5rem' }}>
        Contact Requests
      </h1>
      <AdminGuide
        pageKey="contacts"
        title="Contacts"
        blurb="Inbox for the storefront contact form."
        tips={['No reply-from-here — copy the email/phone and respond externally.']}
      />
      <div style={{ display: 'grid', gap: 12 }}>
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/contacts/page.tsx"
git commit -m "Add guide box to admin Contacts"
```

---

### Task 13: Catalogue/comments — mobile card fallback (no guide box, out of section scope)

**Goal:** The 4 tables across `catalogue/comments` (list) and `catalogue/comments/[productId]` (detail) get mobile card fallbacks. These are sub-pages of Products, not top-level sections — no guide box per spec scope.

**Files:**
- Modify: `app/(admin)/admin/catalogue/comments/page.tsx`
- Modify: `app/(admin)/admin/catalogue/comments/[productId]/page.tsx`

**Acceptance Criteria:**
- [ ] All 4 tables (feedback list, all-products list, comments, reactions) show a card view below 768px
- [ ] Card views show the same data as their table counterparts

**Verify:** `npx tsc --noEmit && npx eslint` on both files → clean. Manual: resize to 375px on both pages, confirm cards replace tables with no horizontal scroll.

**Steps:**

- [ ] **Step 1: Add card list for the "feedback" table in `catalogue/comments/page.tsx`**

Change:

```tsx
      {withFeedback.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', padding: '3rem 1.25rem', color: '#9ca3af' }}>
          <p style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', color: '#374151' }}>No catalogue feedback yet</p>
          <p style={{ fontSize: '0.875rem', margin: 0 }}>Comments and reactions will appear here once guests use the catalogue.</p>
        </div>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: '2rem' }}>
```

to:

```tsx
      {withFeedback.length === 0 ? (
        <div className="admin-panel" style={{ textAlign: 'center', padding: '3rem 1.25rem', color: '#9ca3af' }}>
          <p style={{ fontSize: '1.125rem', margin: '0 0 0.5rem', color: '#374151' }}>No catalogue feedback yet</p>
          <p style={{ fontSize: '0.875rem', margin: 0 }}>Comments and reactions will appear here once guests use the catalogue.</p>
        </div>
      ) : (
        <>
        <ul className="admin-cards" style={{ marginBottom: '2rem' }}>
          {withFeedback.map((p) => (
            <li key={p.id} className="admin-card">
              <div className="admin-card__media">
                {p.images[0] ? (
                  <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(184, 150, 62, 0.35)', fontSize: '1.125rem' }}>V</div>
                )}
              </div>
              <div className="admin-card__body">
                <span className="admin-card__title">{p.name}</span>
                <p className="admin-card__meta">
                  {CATEGORY_LABELS[p.category] ?? p.category}
                  {!p.isActive && ' · Inactive'}
                </p>
                <p className="admin-card__meta">
                  {likeMap[p.id] ?? 0} likes · {dislikeMap[p.id] ?? 0} dislikes · {commentMap[p.id] ?? 0} comments
                </p>
                <Link href={`/admin/catalogue/comments/${p.id}`} style={{ fontSize: '0.75rem', color: '#b8963e', fontWeight: 500, textDecoration: 'none' }}>
                  View details →
                </Link>
              </div>
            </li>
          ))}
        </ul>
        <div className="admin-table-wrap" style={{ marginBottom: '2rem' }}>
```

Then close the added fragment — change:

```tsx
        </div>
      )}

      <h2 style={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 1rem' }}>
        All products ({products.length})
      </h2>
```

to:

```tsx
        </div>
        </>
      )}

      <h2 style={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 1rem' }}>
        All products ({products.length})
      </h2>
```

- [ ] **Step 2: Add card list for the "all products" table in the same file**

Change:

```tsx
      <h2 style={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 1rem' }}>
        All products ({products.length})
      </h2>
      <div className="admin-table-wrap">
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
```

to:

```tsx
      <h2 style={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 1rem' }}>
        All products ({products.length})
      </h2>
      <ul className="admin-cards">
        {products.map((p) => (
          <li key={p.id} className="admin-card admin-card--no-media">
            <div className="admin-card__body">
              <span className="admin-card__title">{p.name}</span>
              <p className="admin-card__meta">{p.itemCode ?? '—'}</p>
              <p className="admin-card__meta">
                {likeMap[p.id] ?? 0} likes · {dislikeMap[p.id] ?? 0} dislikes · {commentMap[p.id] ?? 0} comments
              </p>
              <Link href={`/admin/catalogue/comments/${p.id}`} style={{ fontSize: '0.75rem', color: '#6b7280', textDecoration: 'none' }}>
                Open
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <div className="admin-table-wrap">
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
```

- [ ] **Step 3: Add card list for the "comments" table in `catalogue/comments/[productId]/page.tsx`**

Change:

```tsx
        {comments.length === 0 ? (
          <p style={emptyBox}>No comments for this product yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
```

to:

```tsx
        {comments.length === 0 ? (
          <p style={emptyBox}>No comments for this product yet.</p>
        ) : (
          <>
          <ul className="admin-cards">
            {comments.map((c) => {
              const guest = guestFromMap(guestMap, c.guestUserId)
              return (
                <li key={c.id} className="admin-card admin-card--no-media">
                  <div className="admin-card__body">
                    <span className="admin-card__title">@{guest.username}</span>
                    <p className="admin-card__meta">{c.body}</p>
                    {guest.email !== '—' && <p className="admin-card__meta">{guest.email}</p>}
                    <p className="admin-card__meta">{formatWhen(c.createdAt)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="admin-table-wrap">
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
```

Then close the fragment — change (the closing of the comments table):

```tsx
            </table>
          </div>
        )}
      </section>

      <section>
```

to:

```tsx
            </table>
          </div>
          </>
        )}
      </section>

      <section>
```

- [ ] **Step 4: Add card list for the "reactions" table in the same file**

Change:

```tsx
        {reactions.length === 0 ? (
          <p style={emptyBox}>No likes or dislikes yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
```

to:

```tsx
        {reactions.length === 0 ? (
          <p style={emptyBox}>No likes or dislikes yet.</p>
        ) : (
          <>
          <ul className="admin-cards">
            {reactions.map((r) => {
              const guest = guestFromMap(guestMap, r.guestUserId)
              const isLike = normReaction(r.reaction) === 'like'
              return (
                <li key={r.id} className="admin-card admin-card--no-media">
                  <div className="admin-card__body">
                    <span className="admin-card__title">@{guest.username}</span>
                    <p className="admin-card__meta">
                      {isLike ? 'Like' : 'Dislike'} · {formatWhen(r.updatedAt)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="admin-table-wrap">
            <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
```

Then close the fragment — change the final closing (end of the reactions table + section):

```tsx
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
```

to:

```tsx
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint "app/(admin)/admin/catalogue/comments/page.tsx" "app/(admin)/admin/catalogue/comments/[productId]/page.tsx"`
Expected: zero findings.

Manual: `npm run dev`, open `/admin/catalogue/comments` and a product detail under it, resize to 375px — cards show, no horizontal scroll.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/catalogue/comments/page.tsx" "app/(admin)/admin/catalogue/comments/[productId]/page.tsx"
git commit -m "Add mobile card fallback to catalogue/comments tables"
```

---

### Task 14: Order detail + Manual Order form — responsive grids (no guide box, sub-pages)

**Goal:** Fix the last two fixed-grid call sites — `orders/[id]` (order detail) and `ManualOrderForm` (orders/new). Both are sub-pages, no guide box.

**Files:**
- Modify: `app/(admin)/admin/orders/[id]/page.tsx:165`
- Modify: `app/(admin)/admin/orders/new/ManualOrderForm.tsx:362`

**Acceptance Criteria:**
- [ ] Order detail's Items/Payment 2-col grid stacks to 1 column below 640px
- [ ] Manual Order form's City/State/Pincode 3-col grid stacks to 1 column below 640px

**Verify:** `npx tsc --noEmit && npx eslint "app/(admin)/admin/orders/[id]/page.tsx" "app/(admin)/admin/orders/new/ManualOrderForm.tsx"` → clean.

**Steps:**

- [ ] **Step 1: Fix the grid in `orders/[id]/page.tsx`**

Change (line 165):

```tsx
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={card}>
          <h3 style={heading}>Items</h3>
```

to:

```tsx
      <div className="admin-grid-2">
        <div style={card}>
          <h3 style={heading}>Items</h3>
```

- [ ] **Step 2: Fix the grid in `ManualOrderForm.tsx`**

Change (line 362):

```tsx
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={label}>City</label>
```

to:

```tsx
        <div className="admin-grid-3">
          <div>
            <label style={label}>City</label>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/orders/[id]/page.tsx" "app/(admin)/admin/orders/new/ManualOrderForm.tsx"
git commit -m "Fix responsive grids on order detail + manual order form"
```

---

## Final check (after all 14 tasks)

- [ ] `npx tsc --noEmit` — zero errors across the whole repo
- [ ] `npx eslint app/\(admin\)` — zero findings
- [ ] Manual pass: open every one of the 11 sections + `orders/[id]`, `orders/new`, `catalogue/comments` (+detail) at 375px width — no horizontal scroll, all grids/tables readable, every guide box collapses/expands and survives a reload
