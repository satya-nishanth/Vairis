# UI-v2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Vairis store UI to the designer's wireframe (vairis-website-wireframe) on a new `UI-v2` branch — keeping all existing backend (Prisma, Supabase, API routes, admin) intact.

**Architecture:** Copy the wireframe's component tree, CSS token system, and page shells verbatim, then replace each wireframe mock data source with real Prisma/Supabase calls. The wireframe lives at `/Users/nishi/Documents/Personal/Passion Projects/Vairis-all/vairis-website-wireframe` (referred to as `WIRE` below). The current app root is `/Users/nishi/Documents/Personal/Passion Projects/Vairis-all/Vairis` (referred to as `APP`).

**Tech Stack:** Next.js 16 + React 19, pure CSS custom-property design tokens (no Tailwind), Supabase Auth (OTP), Prisma 5, Vercel deployment.

**Source repo paths used throughout:**
- `WIRE` = `/Users/nishi/Documents/Personal/Passion Projects/Vairis-all/vairis-website-wireframe`
- `APP` = `/Users/nishi/Documents/Personal/Passion Projects/Vairis-all/Vairis`

---

## File Map

### Files to CREATE in APP (copied from WIRE, then adapted)

**CSS system** (new directory `APP/src/styles/` — note the app has no `src/` yet; files go in `APP/styles/`)
- `APP/styles/tokens.css` ← `WIRE/src/styles/tokens.css`
- `APP/styles/themes/light.css` ← `WIRE/src/styles/themes/light.css`
- `APP/styles/themes/dark.css` ← `WIRE/src/styles/themes/dark.css`
- `APP/styles/reset.css` ← `WIRE/src/styles/reset.css`
- `APP/styles/layout.css` ← `WIRE/src/styles/layout.css`
- `APP/styles/components.css` ← `WIRE/src/styles/components.css`
- `APP/styles/auth.css` ← `WIRE/src/styles/auth.css`
- `APP/styles/responsive.css` ← `WIRE/src/styles/responsive.css`
- `APP/styles/pages/home.css` ← `WIRE/src/styles/pages/home.css`
- `APP/styles/pages/plp.css` ← `WIRE/src/styles/pages/plp.css`
- `APP/styles/pages/pdp.css` ← `WIRE/src/styles/pages/pdp.css`
- `APP/styles/pages/cart.css` ← `WIRE/src/styles/pages/cart.css`
- `APP/styles/pages/checkout.css` ← `WIRE/src/styles/pages/checkout.css`
- `APP/styles/pages/confirmation.css` ← `WIRE/src/styles/pages/confirmation.css`
- `APP/styles/pages/contact.css` ← `WIRE/src/styles/pages/contact.css`
- `APP/styles/pages/returns.css` ← `WIRE/src/styles/pages/returns.css`
- `APP/styles/pages/wishlist.css` ← `WIRE/src/styles/pages/wishlist.css`

**Lib (static content — copy verbatim, no backend wiring needed)**
- `APP/lib/theme.ts`
- `APP/lib/layout-config.ts`
- `APP/lib/promo-bar-content.ts`
- `APP/lib/trust-content.ts`
- `APP/lib/footer-content.ts`
- `APP/lib/home-content.ts`
- `APP/lib/plp-content.ts`
- `APP/lib/compare-trust-content.ts`
- `APP/lib/category-stories.ts`
- `APP/lib/images.ts`
- `APP/lib/logo.ts`
- `APP/lib/catalogue-ui.ts` ← `WIRE/src/lib/catalogue.ts` (rename to avoid clash with existing catalogue-* files)
- `APP/lib/category-hero-images.ts`

**Lib (data adapters — new files)**
- `APP/lib/prisma-to-product.ts` — converts Prisma Product + gold rates → wireframe `Product` shape

**Components (copied verbatim from WIRE, no changes)**
- `APP/components/ui/Button.tsx`
- `APP/components/ui/Container.tsx`
- `APP/components/ui/Section.tsx`
- `APP/components/ui/Breadcrumbs.tsx`
- `APP/components/ui/ProductImage.tsx`
- `APP/components/ui/MarketingImage.tsx`
- `APP/components/ui/Rating.tsx`
- `APP/components/ui/Accordion.tsx`
- `APP/components/ui/Stepper.tsx`
- `APP/components/icons/index.tsx`
- `APP/components/icons/ThemeIcon.tsx`
- `APP/components/theme/ThemeProvider.tsx`
- `APP/components/theme/ThemeSwitcher.tsx`
- `APP/components/theme/ThemeInitScript.tsx`
- `APP/components/layout/BrandLogo.tsx`
- `APP/components/layout/SiteHeader.tsx`
- `APP/components/layout/SiteFooter.tsx`
- `APP/components/layout/PageShell.tsx`
- `APP/components/layout/PromoBar.tsx`
- `APP/components/layout/TrustBar.tsx`
- `APP/components/layout/ContactUsFab.tsx`
- `APP/components/layout/FooterAccordion.tsx`
- `APP/components/layout/SiteHeaderMobileToggle.tsx`
- `APP/components/layout/HeaderPincode.tsx`
- `APP/components/layout/HeaderSearchButton.tsx`
- `APP/components/layout/HeaderWishlistLink.tsx`
- `APP/components/layout/MobileSearchOverlay.tsx`
- `APP/components/navigation/LegacyCategoryRedirect.tsx`
- `APP/components/content/TestimonialCard.tsx`
- `APP/components/home/HeroCarousel.tsx`
- `APP/components/home/HomeSectionHead.tsx`
- `APP/components/home/WhyVairisLandingImage.tsx`
- `APP/components/commerce/CategoryCard.tsx`
- `APP/components/commerce/CategoryCarouselSection.tsx`
- `APP/components/commerce/CategoryFilterPanel.tsx`
- `APP/components/commerce/CategoryFilterSidebar.tsx`
- `APP/components/commerce/CategoryHeroCarousel.tsx`
- `APP/components/commerce/CategoryHeroMediaCarousel.tsx`
- `APP/components/commerce/CategoryHeroStory.tsx`
- `APP/components/commerce/CategoryPage.tsx`
- `APP/components/commerce/CategoryPageView.tsx`
- `APP/components/commerce/CategoryPagination.tsx`
- `APP/components/commerce/CommerceTrustHelpPanel.tsx`
- `APP/components/commerce/MobileCheckoutBar.tsx`
- `APP/components/commerce/MobileFilterBar.tsx`
- `APP/components/commerce/MobileFilterDrawer.tsx`
- `APP/components/commerce/OrderSummary.tsx`
- `APP/components/commerce/PdpStickyBar.tsx`
- `APP/components/commerce/PlpPostGridSection.tsx`
- `APP/components/commerce/ProductCard.tsx`
- `APP/components/commerce/WhyVairisCompareSection.tsx`
- `APP/components/commerce/WishlistButton.tsx`
- `APP/components/commerce/CartItem.tsx`
- `APP/components/commerce/CartModal.tsx`

**Components (adapted — wire to real backend)**
- `APP/components/commerce/WishlistPageView.tsx` — swap mock data for real `/api/wishlist`
- `APP/components/commerce/WishlistProvider.tsx` — wire to `/api/wishlist` + Supabase session
- `APP/components/layout/HeaderAccountButton.tsx` — wire to Supabase session (link to `/auth/login`)
- `APP/components/auth/AuthProvider.tsx` — wire `useAuth()` to Supabase session (read-only; sign-in delegates to `/auth/login`)

**Pages (new routes)**
- `APP/app/all-products/[category]/page.tsx` — PLP (Prisma + catalogue)
- `APP/app/product/[id]/page.tsx` — PDP (Prisma, new shell)
- `APP/app/product/[id]/ProductPageClient.tsx` — PDP client (adapted from WIRE)
- `APP/app/wishlist/page.tsx` ← `WIRE/src/app/wishlist/page.tsx`
- `APP/app/cart/page.tsx` ← `WIRE/src/app/cart/page.tsx`
- `APP/app/checkout/page.tsx` ← `WIRE/src/app/checkout/page.tsx`
- `APP/app/order-confirmation/page.tsx` ← `WIRE/src/app/order-confirmation/page.tsx`
- `APP/app/contact/page.tsx` ← `WIRE/src/app/contact/page.tsx`
- `APP/app/returns/page.tsx` ← `WIRE/src/app/returns/page.tsx`

**Files to MODIFY in APP**
- `APP/package.json` — Next 16 + React 19, remove Tailwind
- `APP/next.config.mjs` → `APP/next.config.ts` — add redirects, add Google Drive remotePattern
- `APP/app/globals.css` — replace Tailwind imports with CSS token system imports
- `APP/app/layout.tsx` — add ThemeProvider, ThemeInitScript, update fonts
- `APP/app/page.tsx` — replace with wireframe home page
- `APP/tsconfig.json` — verify `@/*` path alias still works (no `src/` prefix needed)

**Files to DELETE from APP**
- `APP/tailwind.config.ts`
- `APP/postcss.config.mjs`
- `APP/app/(store)/layout.tsx` — old store shell (has Navbar)
- `APP/app/(store)/shop/**` — all old shop routes (redirected in next.config)
- `APP/components/store/Navbar.tsx` — replaced by SiteHeader
- `APP/components/store/HeroCarousel.tsx` — replaced by wireframe's
- `APP/components/store/ProductCard.tsx` — replaced by wireframe's
- `APP/components/store/MediaGallery.tsx` — replaced by PDP client gallery
- `APP/components/store/GoldRateBanner.tsx` — no longer used

**Files to KEEP unchanged in APP**
- All `APP/app/api/**` routes
- `APP/app/auth/**`
- `APP/app/(admin)/**`
- `APP/app/catalogue/**`
- `APP/lib/auth.ts` (Supabase server auth)
- `APP/lib/prisma.ts`
- `APP/lib/pricing.ts`
- `APP/lib/supabase*.ts`
- `APP/lib/catalogue-auth.ts`, `lib/catalogue-feed.ts`, etc. (catalogue reel)
- `APP/prisma/schema.prisma`

---

## Tasks

### Task 0: Create UI-v2 branch

**Goal:** Branch off master and capture current state.

**Files:** none

**Acceptance Criteria:**
- [ ] Branch `UI-v2` exists and is checked out
- [ ] `git log --oneline -1` matches master HEAD

**Steps:**

- [ ] **Step 1: Create and check out branch**

```bash
cd "APP"
git checkout master
git pull
git checkout -b UI-v2
git log --oneline -1
```

Expected output: the latest master commit hash.

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "chore: initialize UI-v2 branch"
```

---

### Task 1: Stack upgrade — Next 16 + React 19, remove Tailwind

**Goal:** Upgrade runtime deps, strip Tailwind toolchain, verify the app still builds.

**Files:**
- Modify: `APP/package.json`
- Delete: `APP/tailwind.config.ts`, `APP/postcss.config.mjs`

**Acceptance Criteria:**
- [ ] `npm install` succeeds
- [ ] `npm run build` compiles (may have TS errors from Tailwind class strings — that's OK at this stage)
- [ ] `tailwindcss` not in `node_modules`

**Steps:**

- [ ] **Step 1: Update package.json**

Replace the `dependencies` / `devDependencies` blocks so they read:

```json
{
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "@supabase/ssr": "^0.6.1",
    "@supabase/supabase-js": "^2.49.4",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "resend": "^4.5.2",
    "tailwind-merge": "^3.5.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.2",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "prisma": "^5.22.0",
    "typescript": "^5"
  }
}
```

Keep `"scripts"` block exactly as-is (the `prisma generate && next build` build command must stay).

- [ ] **Step 2: Remove Tailwind config files**

```bash
rm "APP/tailwind.config.ts" "APP/postcss.config.mjs"
```

- [ ] **Step 3: Install**

```bash
cd "APP" && npm install
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git rm tailwind.config.ts postcss.config.mjs
git commit -m "chore: upgrade Next 16 + React 19, remove Tailwind"
```

---

### Task 2: Copy wireframe CSS system

**Goal:** Install the designer's CSS token system so all wireframe components can render correctly.

**Files:**
- Create: `APP/styles/` directory with all CSS files
- Modify: `APP/app/globals.css`

**Acceptance Criteria:**
- [ ] `APP/styles/tokens.css` exists with `:root { --emerald-deep: #032b24; ... }` variables
- [ ] `APP/app/globals.css` starts with `@import "../styles/tokens.css";` (no Tailwind directives)
- [ ] `npm run dev` starts without CSS errors in browser console

**Steps:**

- [ ] **Step 1: Create styles directory and copy all files**

```bash
mkdir -p "APP/styles/themes" "APP/styles/pages"

for f in tokens.css reset.css layout.css components.css auth.css responsive.css; do
  cp "WIRE/src/styles/$f" "APP/styles/$f"
done

cp "WIRE/src/styles/themes/light.css" "APP/styles/themes/light.css"
cp "WIRE/src/styles/themes/dark.css" "APP/styles/themes/dark.css"

for f in home.css plp.css pdp.css cart.css checkout.css confirmation.css contact.css returns.css wishlist.css; do
  cp "WIRE/src/styles/pages/$f" "APP/styles/pages/$f"
done
```

- [ ] **Step 2: Replace globals.css**

Write `APP/app/globals.css`:

```css
@import "../styles/tokens.css";
@import "../styles/themes/light.css";
@import "../styles/themes/dark.css";
@import "../styles/reset.css";
@import "../styles/layout.css";
@import "../styles/components.css";
@import "../styles/pages/home.css";
@import "../styles/pages/plp.css";
@import "../styles/pages/pdp.css";
@import "../styles/pages/cart.css";
@import "../styles/pages/checkout.css";
@import "../styles/pages/confirmation.css";
@import "../styles/pages/contact.css";
@import "../styles/pages/returns.css";
@import "../styles/pages/wishlist.css";
@import "../styles/auth.css";
@import "../styles/responsive.css";
```

- [ ] **Step 3: Verify dev starts**

```bash
cd "APP" && npm run dev
```

Open `http://localhost:3000` — should see the current home page (unstyled or broken look is expected since components still use Tailwind class names, but no crash).

- [ ] **Step 4: Commit**

```bash
git add styles/ app/globals.css
git commit -m "feat(ui-v2): add wireframe CSS token system, remove Tailwind"
```

---

### Task 3: Copy wireframe static lib files

**Goal:** Bring all static content helpers (layout configs, trust copy, footer copy, promo copy, home content, category stories, images map) from wireframe into the app.

**Files:**
- Create: `APP/lib/theme.ts`, `APP/lib/layout-config.ts`, `APP/lib/promo-bar-content.ts`, `APP/lib/trust-content.ts`, `APP/lib/footer-content.ts`, `APP/lib/home-content.ts`, `APP/lib/plp-content.ts`, `APP/lib/compare-trust-content.ts`, `APP/lib/category-stories.ts`, `APP/lib/images.ts`, `APP/lib/logo.ts`, `APP/lib/category-hero-images.ts`
- Create: `APP/lib/catalogue-ui.ts` (renamed from `WIRE/src/lib/catalogue.ts`)
- Create: `APP/data/catalogue-manifest.json`, `APP/data/category-hero-manifest.json`

**Acceptance Criteria:**
- [ ] `import { pageLayouts } from '@/lib/layout-config'` resolves with no TS error
- [ ] `import { catalogueProducts } from '@/lib/catalogue-ui'` resolves
- [ ] `APP/data/catalogue-manifest.json` exists with `products` array

**Steps:**

- [ ] **Step 1: Copy static lib files**

```bash
for f in theme.ts layout-config.ts promo-bar-content.ts trust-content.ts footer-content.ts \
          home-content.ts plp-content.ts compare-trust-content.ts category-stories.ts \
          images.ts logo.ts category-hero-images.ts; do
  cp "WIRE/src/lib/$f" "APP/lib/$f"
done
```

- [ ] **Step 2: Copy catalogue lib (renamed to avoid collision)**

```bash
cp "WIRE/src/lib/catalogue.ts" "APP/lib/catalogue-ui.ts"
```

Then open `APP/lib/catalogue-ui.ts` and change the import at the top:

```typescript
// Change this line:
import manifest from "@/data/catalogue-manifest.json";
// It stays the same — the data/ folder will be created in step 3.
```

Then update all internal self-references (if any) from `@/lib/catalogue` → `@/lib/catalogue-ui`. (Run a search: `grep -n '@/lib/catalogue' "APP/lib/catalogue-ui.ts"` — there should be none since it's a self-contained file.)

- [ ] **Step 3: Copy data manifests**

```bash
mkdir -p "APP/data"
cp "WIRE/src/data/catalogue-manifest.json" "APP/data/catalogue-manifest.json"
cp "WIRE/src/data/category-hero-manifest.json" "APP/data/category-hero-manifest.json"
```

- [ ] **Step 4: Copy lib/data.ts (wireframe Product type + adapters)**

```bash
cp "WIRE/src/lib/data.ts" "APP/lib/ui-data.ts"
```

Open `APP/lib/ui-data.ts` and change the catalogue import to use the renamed module:

```typescript
// Change:
import type { CatalogueProduct, ProductCategory } from "./catalogue";
import {
  CATEGORY_LABELS,
  getCategoryHeroImage,
  getCategoryPreviewImages,
  getFeaturedProducts,
  getProductBySlug,
  getProductsByCategory,
  SHOP_CATEGORIES,
} from "./catalogue";
// To:
import type { CatalogueProduct, ProductCategory } from "./catalogue-ui";
import {
  CATEGORY_LABELS,
  getCategoryHeroImage,
  getCategoryPreviewImages,
  getFeaturedProducts,
  getProductBySlug,
  getProductsByCategory,
  SHOP_CATEGORIES,
} from "./catalogue-ui";
```

- [ ] **Step 5: Update tsconfig.json to resolve `@/data`**

Open `APP/tsconfig.json`. The existing `"paths": { "@/*": ["./*"] }` already covers `@/data/...` as long as files are at root level. Verify:

```bash
grep -A5 '"paths"' "APP/tsconfig.json"
```

Should show `"@/*": ["./*"]`. If it shows `"@/*": ["./src/*"]`, change to `"@/*": ["./*"]`.

- [ ] **Step 6: Commit**

```bash
cd "APP" && git add lib/theme.ts lib/layout-config.ts lib/promo-bar-content.ts \
  lib/trust-content.ts lib/footer-content.ts lib/home-content.ts lib/plp-content.ts \
  lib/compare-trust-content.ts lib/category-stories.ts lib/images.ts lib/logo.ts \
  lib/category-hero-images.ts lib/catalogue-ui.ts lib/ui-data.ts data/
git commit -m "feat(ui-v2): copy wireframe static lib files and catalogue manifests"
```

---

### Task 4: Copy wireframe UI primitives + theme system

**Goal:** Get all leaf-level components and the theme provider into the app.

**Files:**
- Create: `APP/components/ui/*` (9 files), `APP/components/icons/*` (2 files), `APP/components/theme/*` (3 files)

**Acceptance Criteria:**
- [ ] `import { Button } from '@/components/ui/Button'` resolves with no TS error
- [ ] `import { ThemeProvider } from '@/components/theme/ThemeProvider'` resolves
- [ ] No `@/lib/catalogue` import errors in copied files (all use `@/lib/catalogue-ui` after fixes)

**Steps:**

- [ ] **Step 1: Copy UI primitives**

```bash
mkdir -p "APP/components/ui"
for f in Button.tsx Container.tsx Section.tsx Breadcrumbs.tsx ProductImage.tsx \
          MarketingImage.tsx Rating.tsx Accordion.tsx Stepper.tsx; do
  cp "WIRE/src/components/ui/$f" "APP/components/ui/$f"
done
```

- [ ] **Step 2: Copy icons**

```bash
mkdir -p "APP/components/icons"
cp "WIRE/src/components/icons/index.tsx" "APP/components/icons/index.tsx"
cp "WIRE/src/components/icons/ThemeIcon.tsx" "APP/components/icons/ThemeIcon.tsx"
```

- [ ] **Step 3: Copy theme components**

```bash
mkdir -p "APP/components/theme"
cp "WIRE/src/components/theme/ThemeProvider.tsx" "APP/components/theme/ThemeProvider.tsx"
cp "WIRE/src/components/theme/ThemeSwitcher.tsx" "APP/components/theme/ThemeSwitcher.tsx"
cp "WIRE/src/components/theme/ThemeInitScript.tsx" "APP/components/theme/ThemeInitScript.tsx"
```

- [ ] **Step 4: Fix any @/lib/catalogue → @/lib/catalogue-ui imports**

```bash
grep -rl '@/lib/catalogue[^-]' "APP/components/ui" "APP/components/icons" "APP/components/theme" 2>/dev/null
```

For each file found, replace `@/lib/catalogue` (not followed by `-`) with `@/lib/catalogue-ui`.

- [ ] **Step 5: Commit**

```bash
cd "APP" && git add components/ui/ components/icons/ components/theme/
git commit -m "feat(ui-v2): copy wireframe UI primitives, icons, theme system"
```

---

### Task 5: Copy wireframe layout components + update root layout

**Goal:** Install the full page shell (Header, Footer, PromoBar, TrustBar, PageShell, etc.) and wire them into `app/layout.tsx`.

**Files:**
- Create: `APP/components/layout/*` (14 files), `APP/components/navigation/LegacyCategoryRedirect.tsx`, `APP/components/content/TestimonialCard.tsx`
- Modify: `APP/app/layout.tsx`
- Create: `APP/public/scripts/vairis-theme-init.js`

**Acceptance Criteria:**
- [ ] `npm run dev` renders a page with the new Header and Footer visible
- [ ] Theme toggle button appears in header
- [ ] No React hydration errors in browser console

**Steps:**

- [ ] **Step 1: Copy layout components**

```bash
mkdir -p "APP/components/layout" "APP/components/navigation" "APP/components/content"

for f in BrandLogo.tsx SiteHeader.tsx SiteFooter.tsx PageShell.tsx PromoBar.tsx \
          TrustBar.tsx ContactUsFab.tsx FooterAccordion.tsx SiteHeaderMobileToggle.tsx \
          HeaderPincode.tsx HeaderSearchButton.tsx HeaderWishlistLink.tsx MobileSearchOverlay.tsx; do
  cp "WIRE/src/components/layout/$f" "APP/components/layout/$f"
done

cp "WIRE/src/components/navigation/LegacyCategoryRedirect.tsx" \
   "APP/components/navigation/LegacyCategoryRedirect.tsx"
cp "WIRE/src/components/content/TestimonialCard.tsx" \
   "APP/components/content/TestimonialCard.tsx"
```

- [ ] **Step 2: Fix catalogue-ui imports in layout components**

```bash
grep -rl "'@/lib/catalogue'" "APP/components/layout" "APP/components/navigation" 2>/dev/null
```

In each file found, replace `'@/lib/catalogue'` with `'@/lib/catalogue-ui'`. (Typically `SiteHeader.tsx` imports `CATEGORY_LABELS`, `categoryHref`, `HEADER_NAV_CATEGORIES`.)

- [ ] **Step 3: Copy blocking theme init script**

```bash
mkdir -p "APP/public/scripts"
cp "WIRE/public/scripts/vairis-theme-init.js" "APP/public/scripts/vairis-theme-init.js" 2>/dev/null || true
```

If the file doesn't exist in WIRE (check first: `ls "WIRE/public/scripts/"`), create it manually:

```javascript
// public/scripts/vairis-theme-init.js
(function () {
  var stored = null;
  try { stored = localStorage.getItem('vairis-theme'); } catch (_) {}
  var theme = stored === 'dark' || stored === 'light' ? stored : 'light';
  document.documentElement.setAttribute('data-theme', theme);
})();
```

- [ ] **Step 4: Copy auth components (shell — mock impl stays for now)**

```bash
mkdir -p "APP/components/auth"
cp "WIRE/src/components/auth/AuthProvider.tsx" "APP/components/auth/AuthProvider.tsx"
cp "WIRE/src/components/auth/AuthPopover.tsx" "APP/components/auth/AuthPopover.tsx"
```

Copy wireframe's `lib/auth.ts` as `lib/ui-auth.ts` (keeps mock OTP helpers — used by AuthPopover UI):

```bash
cp "WIRE/src/lib/auth.ts" "APP/lib/ui-auth.ts"
```

Open `APP/components/auth/AuthProvider.tsx` and change:

```typescript
// Change:
import {
  loadStoredUser,
  saveStoredUser,
  type AuthChannel,
  type AuthUser,
} from "@/lib/auth";
// To:
import {
  loadStoredUser,
  saveStoredUser,
  type AuthChannel,
  type AuthUser,
} from "@/lib/ui-auth";
```

Open `APP/components/auth/AuthPopover.tsx` and change:

```typescript
// Change:
} from "@/lib/auth";
// To:
} from "@/lib/ui-auth";
```

Open `APP/components/layout/HeaderAccountButton.tsx` (copy it first):

```bash
cp "WIRE/src/components/layout/HeaderAccountButton.tsx" \
   "APP/components/layout/HeaderAccountButton.tsx"
```

**Replace** the `HeaderAccountButton` implementation to link to Supabase auth pages instead of opening the popover. This keeps the wireframe's UI shell but delegates auth to the existing `/auth/login` flow:

```typescript
// APP/components/layout/HeaderAccountButton.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { IconAccount } from "@/components/icons";

export function HeaderAccountButton() {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (userEmail) {
    return (
      <Link href="/account" className="header-account-btn" aria-label={`Account: ${userEmail}`}>
        <IconAccount />
      </Link>
    );
  }

  return (
    <Link href="/auth/login" className="header-account-btn" aria-label="Sign in">
      <IconAccount />
    </Link>
  );
}
```

- [ ] **Step 5: Update root layout.tsx**

Replace `APP/app/layout.tsx` with:

```typescript
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { WishlistProvider } from "@/components/commerce/WishlistProvider";
import { DEFAULT_SITE_THEME } from "@/lib/theme";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-serif-loaded",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-loaded",
});

export const metadata: Metadata = {
  title: "VAIRIS - Everyday Diamond Wear",
  description:
    "Minimal diamond jewellery designed for work, coffee runs, date nights and everyday confidence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${inter.variable}`}
      data-theme={DEFAULT_SITE_THEME}
      suppressHydrationWarning
    >
      <head>
        <script src="/scripts/vairis-theme-init.js" />
      </head>
      <body>
        <ThemeProvider defaultTheme={DEFAULT_SITE_THEME}>
          <WishlistProvider>{children}</WishlistProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Note: `WishlistProvider` gets wired to the real API in Task 10. For now it uses the wireframe's localStorage implementation (which is fine for the layout shell).

- [ ] **Step 6: Copy WishlistProvider (localStorage version for now)**

```bash
mkdir -p "APP/components/commerce"
cp "WIRE/src/components/commerce/WishlistProvider.tsx" \
   "APP/components/commerce/WishlistProvider.tsx"
```

- [ ] **Step 7: Start dev and verify header renders**

```bash
cd "APP" && npm run dev
```

Open `http://localhost:3000`. Expect: new-style header with logo, nav links, theme toggle. May see unstyled body — that's OK.

- [ ] **Step 8: Commit**

```bash
cd "APP" && git add components/layout/ components/navigation/ components/content/ \
  components/auth/ components/commerce/WishlistProvider.tsx \
  lib/ui-auth.ts public/scripts/vairis-theme-init.js app/layout.tsx
git commit -m "feat(ui-v2): copy layout shell, auth components, update root layout"
```

---

### Task 6: Copy public assets (icons, brand images)

**Goal:** Copy the wireframe's icon SVG set and any logo/brand static files so header icons render.

**Files:**
- Create: `APP/public/icons/` tree (100+ SVGs)
- Create: `APP/public/images/` (logo, placeholder lifestyle images)

**Acceptance Criteria:**
- [ ] `http://localhost:3000` shows header icons (account, wishlist, cart, theme toggle)
- [ ] VAIRIS logo renders in header

**Steps:**

- [ ] **Step 1: Copy icon SVGs**

```bash
cp -r "WIRE/public/icons" "APP/public/icons"
```

- [ ] **Step 2: Copy/verify logo file**

Check what BrandLogo.tsx expects:

```bash
grep -n 'src\|href\|img' "APP/components/layout/BrandLogo.tsx" | head -10
```

Copy whatever static logo file it references (e.g., `/images/logo.svg` or `/logo.png`):

```bash
cp -r "WIRE/public/images" "APP/public/images" 2>/dev/null || true
```

If `WIRE/public/images` doesn't exist or is empty, check `APP/public/images` — the current app may already have logos from the `app/icon.png` or uploaded assets. Look at `WIRE/src/lib/logo.ts` to see what filename is expected, then ensure that file exists in `APP/public/images/`.

- [ ] **Step 3: Commit**

```bash
cd "APP" && git add public/icons/ public/images/
git commit -m "feat(ui-v2): copy wireframe icon SVGs and brand image assets"
```

---

### Task 7: Home page migration

**Goal:** Replace current placeholder home page with wireframe's rich home page, wired to real catalogue data.

**Files:**
- Modify: `APP/app/page.tsx`
- Create: `APP/components/home/HeroCarousel.tsx`, `APP/components/home/HomeSectionHead.tsx`, `APP/components/home/WhyVairisLandingImage.tsx`
- Create: `APP/components/commerce/CategoryCard.tsx`, `APP/components/commerce/CategoryCarouselSection.tsx`

**Acceptance Criteria:**
- [ ] `http://localhost:3000` shows Hero carousel, category grid, testimonials
- [ ] Category links navigate to `/all-products/[category]`
- [ ] No JS errors in browser console

**Steps:**

- [ ] **Step 1: Copy home page components**

```bash
for f in HeroCarousel.tsx HomeSectionHead.tsx WhyVairisLandingImage.tsx; do
  cp "WIRE/src/components/home/$f" "APP/components/home/$f"
done

for f in CategoryCard.tsx CategoryCarouselSection.tsx; do
  cp "WIRE/src/components/commerce/$f" "APP/components/commerce/$f"
done
```

- [ ] **Step 2: Fix imports in copied components**

```bash
grep -rl "'@/lib/catalogue'" "APP/components/home" "APP/components/commerce/CategoryCard.tsx" \
  "APP/components/commerce/CategoryCarouselSection.tsx" 2>/dev/null
```

Replace `@/lib/catalogue` with `@/lib/catalogue-ui` in each found file. Also replace `from "@/lib/data"` → `from "@/lib/ui-data"` where it appears.

- [ ] **Step 3: Replace app/page.tsx**

Copy wireframe home page then fix imports:

```bash
cp "WIRE/src/app/page.tsx" "APP/app/page.tsx"
```

Open `APP/app/page.tsx` and apply these import replacements:

```typescript
// from "@/lib/catalogue" → from "@/lib/catalogue-ui"
// from "@/lib/data" → from "@/lib/ui-data"
```

Run a targeted sed or edit the file manually. Verify the result compiles:

```bash
cd "APP" && npx tsc --noEmit 2>&1 | head -30
```

Fix any TS errors (typically: missing exports or wrong module paths).

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000`. Walk through: hero carousel auto-advances, category cards link to `/all-products/[category]`, theme toggle works (light/dark).

- [ ] **Step 5: Commit**

```bash
cd "APP" && git add app/page.tsx components/home/ components/commerce/CategoryCard.tsx \
  components/commerce/CategoryCarouselSection.tsx
git commit -m "feat(ui-v2): home page — hero, categories, testimonials"
```

---

### Task 8: Copy remaining commerce components

**Goal:** Copy all commerce components used by PLP and PDP so those pages can be built in the next tasks.

**Files:**
- Create: `APP/components/commerce/` — 15 more files

**Acceptance Criteria:**
- [ ] `npx tsc --noEmit` passes for all copied components (or only shows errors about missing page-level imports, not component internals)

**Steps:**

- [ ] **Step 1: Copy all remaining commerce components**

```bash
for f in CategoryFilterPanel.tsx CategoryFilterSidebar.tsx CategoryHeroCarousel.tsx \
          CategoryHeroMediaCarousel.tsx CategoryHeroStory.tsx CategoryPage.tsx \
          CategoryPageView.tsx CategoryPagination.tsx CommerceTrustHelpPanel.tsx \
          MobileCheckoutBar.tsx MobileFilterBar.tsx MobileFilterDrawer.tsx \
          OrderSummary.tsx PdpStickyBar.tsx PlpPostGridSection.tsx \
          ProductCard.tsx WhyVairisCompareSection.tsx WishlistButton.tsx \
          CartItem.tsx CartModal.tsx; do
  cp "WIRE/src/components/commerce/$f" "APP/components/commerce/$f"
done
```

- [ ] **Step 2: Fix all @/lib/catalogue and @/lib/data imports**

```bash
find "APP/components/commerce" -name "*.tsx" -exec \
  sed -i '' "s|from \"@/lib/catalogue\"|from \"@/lib/catalogue-ui\"|g; \
             s|from '@/lib/catalogue'|from '@/lib/catalogue-ui'|g; \
             s|from \"@/lib/data\"|from \"@/lib/ui-data\"|g; \
             s|from '@/lib/data'|from '@/lib/ui-data'|g" {} \;
```

Then verify no stale imports remain:

```bash
grep -rn "'@/lib/catalogue'" "APP/components/commerce/" | grep -v 'catalogue-ui'
grep -rn '"@/lib/catalogue"' "APP/components/commerce/" | grep -v 'catalogue-ui'
```

Should return nothing.

- [ ] **Step 3: TS check**

```bash
cd "APP" && npx tsc --noEmit 2>&1 | grep -v 'node_modules' | head -40
```

Fix any import errors. Errors from pages that don't exist yet (e.g., `Cannot find module '../app/product/...'`) are expected and OK at this stage.

- [ ] **Step 4: Commit**

```bash
cd "APP" && git add components/commerce/
git commit -m "feat(ui-v2): copy all commerce UI components"
```

---

### Task 9: PLP migration — /all-products/[category]

**Goal:** Create category listing pages that fetch real products from Prisma and render them with the wireframe's CategoryPageView.

**Files:**
- Create: `APP/app/all-products/[category]/page.tsx`
- Create: `APP/lib/prisma-to-product.ts`

**Acceptance Criteria:**
- [ ] `http://localhost:3000/all-products/rings` shows real ring products from Prisma DB
- [ ] Each product card shows name + image (price shown as "Enquire for Price" if no gold rate)
- [ ] `http://localhost:3000/all-products/earrings` shows earring products
- [ ] `http://localhost:3000/all-products/necklaces` shows empty state (no Prisma data yet — expected)
- [ ] Category hero image and story copy render

**Steps:**

- [ ] **Step 1: Create Prisma-to-Product adapter**

Create `APP/lib/prisma-to-product.ts`:

```typescript
import type { Product as PrismaProduct, ProductVariant, GoldRate } from "@prisma/client";
import type { Product, ProductCategory } from "@/lib/ui-data";
import { calculatePrice } from "@/lib/pricing";

const PRISMA_TO_CATALOGUE_CATEGORY: Record<string, ProductCategory> = {
  RINGS: "rings",
  EARRINGS: "earrings",
  PENDANTS: "pendants",
  BRACELETS: "bracelets",
};

type PrismaProductWithVariants = PrismaProduct & {
  variants: ProductVariant[];
};

export function prismaToProduct(
  p: PrismaProductWithVariants,
  goldRates: GoldRate[],
  index = 0,
): Product {
  // Compute cheapest variant price if variants + gold rates exist
  let price: number | undefined;
  if (p.variants.length > 0 && goldRates.length > 0) {
    const rateMap = Object.fromEntries(
      goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]),
    );
    const prices = p.variants
      .map((v) => {
        const rate = rateMap[v.metalType];
        if (!rate) return null;
        return calculatePrice({
          weightGrams: Number(v.weightGrams),
          goldRatePerGram: rate,
          makingChargePerGram: Number(v.makingChargePerGram),
          flatMakingCharge: Number(v.flatMakingCharge),
          stoneCharges: Number(v.stoneCharges),
          miscCharges: Number(v.miscCharges),
        });
      })
      .filter((n): n is number => n !== null);
    if (prices.length > 0) price = Math.min(...prices);
  }

  return {
    slug: p.id,
    sku: p.itemCode ?? p.id,
    name: p.name,
    description: p.description,
    price,
    image: p.images[0] ?? "",
    images: p.images,
    category: PRISMA_TO_CATALOGUE_CATEGORY[p.category] ?? "other",
    catalogueId: p.id,
    video: null,
    badge: index === 0 ? "Best Seller" : undefined,
    meta: "Insured Delivery",
  };
}
```

Note: `calculatePrice` is the existing function in `APP/lib/pricing.ts`. Verify its signature:

```bash
grep -n 'export function calculatePrice\|export default' "APP/lib/pricing.ts" | head -5
```

If the signature differs, adapt the call accordingly.

- [ ] **Step 2: Create PLP page**

Create `APP/app/all-products/[category]/page.tsx`:

```typescript
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoryPage } from "@/components/commerce/CategoryPage";
import { CATEGORY_LABELS, isShopCategory, SHOP_CATEGORIES } from "@/lib/catalogue-ui";
import { prismaToProduct } from "@/lib/prisma-to-product";
import type { ShopCategory } from "@/lib/catalogue-ui";
import type { Product } from "@/lib/ui-data";

export const revalidate = 60;

// Map wireframe category slug → Prisma Category enum value
const CATALOGUE_TO_PRISMA: Record<string, string> = {
  rings: "RINGS",
  earrings: "EARRINGS",
  pendants: "PENDANTS",
  bracelets: "BRACELETS",
};

export function generateStaticParams() {
  return SHOP_CATEGORIES.map((category) => ({ category }));
}

type PageProps = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  if (!isShopCategory(category)) return {};
  const meta = CATEGORY_LABELS[category as ShopCategory];
  return {
    title: `${meta.title} | VAIRIS`,
    description: meta.intro,
  };
}

export default async function AllProductsCategoryPage({ params }: PageProps) {
  const { category } = await params;
  if (!isShopCategory(category)) notFound();

  const prismaCategory = CATALOGUE_TO_PRISMA[category];

  let prismaProducts: Product[] = [];
  if (prismaCategory) {
    const [dbProducts, goldRates] = await Promise.all([
      prisma.product.findMany({
        where: { category: prismaCategory as any, isActive: true },
        include: { variants: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.goldRate.findMany(),
    ]);
    prismaProducts = dbProducts.map((p, i) => prismaToProduct(p, goldRates, i));
  }

  return (
    <CategoryPage
      category={category as ShopCategory}
      prismaProducts={prismaProducts.length > 0 ? prismaProducts : undefined}
    />
  );
}
```

- [ ] **Step 3: Adapt CategoryPage to accept optional prismaProducts**

Open `APP/components/commerce/CategoryPage.tsx`. Change its signature to accept an optional `prismaProducts` override:

```typescript
import { CategoryPageView } from "@/components/commerce/CategoryPageView";
import { pickRandomCategoryStory } from "@/lib/category-stories";
import type { ShopCategory } from "@/lib/catalogue-ui";
import type { Product } from "@/lib/ui-data";

type CategoryPageProps = {
  category: ShopCategory;
  prismaProducts?: Product[];
};

export function CategoryPage({ category, prismaProducts }: CategoryPageProps) {
  const story = pickRandomCategoryStory(category);
  return <CategoryPageView category={category} story={story} prismaProducts={prismaProducts} />;
}
```

- [ ] **Step 4: Adapt CategoryPageView to use prismaProducts when provided**

Open `APP/components/commerce/CategoryPageView.tsx`. Find where it calls `getCategoryProducts(category)` and replace with:

```typescript
// At the top of the component function, after receiving props:
const products = prismaProducts ?? getCategoryProducts(category);
```

Add `prismaProducts?: Product[]` to the props type. The component then uses `products` instead of the direct `getCategoryProducts()` call throughout.

Also fix: all links to product detail pages use `linkPrefix="/product"` (already the default in ProductCard) so links go to `/product/[id]` where id is the Prisma cuid.

- [ ] **Step 5: Verify**

```bash
npm run dev
```

Open `http://localhost:3000/all-products/rings`. Verify:
- Product cards appear with real product names and Supabase images
- Prices show in ₹ format if gold rates exist in DB, otherwise absent
- "Best Seller" badge on first product

Open `http://localhost:3000/all-products/necklaces`. Verify:
- Empty state renders (no crash)

- [ ] **Step 6: Commit**

```bash
cd "APP" && git add app/all-products/ lib/prisma-to-product.ts components/commerce/CategoryPage.tsx \
  components/commerce/CategoryPageView.tsx
git commit -m "feat(ui-v2): PLP — category pages wired to Prisma with real pricing"
```

---

### Task 10: PDP migration — /product/[id]

**Goal:** Create product detail pages that fetch from Prisma and render the wireframe's PDP shell with real images, variants, and pricing.

**Files:**
- Create: `APP/app/product/[id]/page.tsx`
- Create: `APP/app/product/[id]/ProductPageClient.tsx`

**Acceptance Criteria:**
- [ ] `http://localhost:3000/product/[any-prisma-id]` renders with product name, images, variant selector
- [ ] Price updates when variant is selected (uses existing `VariantSelector` logic)
- [ ] WhatsApp enquiry link works (pre-fills product name)
- [ ] Related products section shows other products in same category
- [ ] Gallery image switching works on mobile and desktop

**Steps:**

- [ ] **Step 1: Create PDP server page**

Create `APP/app/product/[id]/page.tsx`:

```typescript
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductPageClient from "./ProductPageClient";

export const revalidate = 120;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id, isActive: true },
    select: { name: true, description: true, images: true },
  });
  if (!product) return {};
  return {
    title: `${product.name} — VAIRIS`,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: product.images[0] ? [product.images[0]] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const [product, goldRates] = await Promise.all([
    prisma.product.findUnique({
      where: { id, isActive: true },
      include: {
        variants: {
          select: {
            id: true,
            metalType: true,
            weightGrams: true,
            makingChargePerGram: true,
            flatMakingCharge: true,
            stoneCharges: true,
            miscCharges: true,
            sku: true,
            size: true,
          },
        },
      },
    }),
    prisma.goldRate.findMany(),
  ]);

  if (!product) notFound();

  return (
    <ProductPageClient
      product={{
        ...product,
        variants: product.variants.map((v) => ({
          ...v,
          weightGrams: v.weightGrams.toString(),
          makingChargePerGram: v.makingChargePerGram.toString(),
          flatMakingCharge: v.flatMakingCharge.toString(),
          stoneCharges: v.stoneCharges.toString(),
          miscCharges: v.miscCharges.toString(),
        })),
      }}
      goldRates={goldRates.map((r) => ({
        metalType: r.metalType,
        ratePerGram: r.ratePerGram.toString(),
      }))}
    />
  );
}
```

- [ ] **Step 2: Create PDP client component**

Create `APP/app/product/[id]/ProductPageClient.tsx`:

```typescript
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductImage } from "@/components/ui/ProductImage";
import { Rating } from "@/components/ui/Rating";
import { ProductCard } from "@/components/commerce/ProductCard";
import { CommerceTrustHelpPanel } from "@/components/commerce/CommerceTrustHelpPanel";
import { CartModalProvider, useCartModal } from "@/components/commerce/CartModal";
import { PdpStickyBar } from "@/components/commerce/PdpStickyBar";
import { CategoryPagination } from "@/components/commerce/CategoryPagination";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { pageLayouts } from "@/lib/layout-config";
import { compareTrustItems } from "@/lib/compare-trust-content";
import { CATEGORY_LABELS } from "@/lib/catalogue-ui";
import { calculatePrice } from "@/lib/pricing";
import type { ProductCategory } from "@/lib/ui-data";

const PRISMA_TO_CATALOGUE_CATEGORY: Record<string, ProductCategory> = {
  RINGS: "rings",
  EARRINGS: "earrings",
  PENDANTS: "pendants",
  BRACELETS: "bracelets",
};

type Variant = {
  id: string;
  metalType: string;
  weightGrams: string;
  makingChargePerGram: string;
  flatMakingCharge: string;
  stoneCharges: string;
  miscCharges: string;
  sku: string | null;
  size: string | null;
};

type GoldRate = {
  metalType: string;
  ratePerGram: string;
};

type ProductData = {
  id: string;
  name: string;
  description: string;
  category: string;
  images: string[];
  itemCode: string | null;
  designStyle: string | null;
  stoneType: string | null;
  stoneShape: string | null;
  stoneDimMm: any;
  gemCount: number | null;
  caratWeight: any;
  totalLengthMm: any;
  motifSizeMm: any;
  thicknessMm: any;
  comingSoon: boolean;
  variants: Variant[];
};

type Props = {
  product: ProductData;
  goldRates: GoldRate[];
};

const METAL_LABELS: Record<string, string> = {
  GOLD_18K: "18kt Yellow Gold",
  GOLD_14K: "14kt Yellow Gold",
  ROSE_GOLD: "Rose Gold 18kt",
};

function PdpContent({ product, goldRates }: Props) {
  const { openCartModal } = useCartModal();
  const [activeThumb, setActiveThumb] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants[0]?.id ?? null,
  );
  const swipeRef = useRef<HTMLDivElement>(null);

  const gallery = product.images.length > 0 ? product.images : [];
  const categorySlug = PRISMA_TO_CATALOGUE_CATEGORY[product.category] ?? "rings";
  const categoryLabel = CATEGORY_LABELS[categorySlug]?.title ?? product.category;
  const categoryHref = `/all-products/${categorySlug}`;

  const rateMap = useMemo(
    () => Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)])),
    [goldRates],
  );

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);
  const price = selectedVariant
    ? calculatePrice({
        weightGrams: Number(selectedVariant.weightGrams),
        goldRatePerGram: rateMap[selectedVariant.metalType] ?? 0,
        makingChargePerGram: Number(selectedVariant.makingChargePerGram),
        flatMakingCharge: Number(selectedVariant.flatMakingCharge),
        stoneCharges: Number(selectedVariant.stoneCharges),
        miscCharges: Number(selectedVariant.miscCharges),
      })
    : null;

  const whatsappText = encodeURIComponent(
    `Hi! I'm interested in *${product.name}*${product.itemCode ? ` (Code: ${product.itemCode})` : ""} from VAIRIS. Could you please share availability?\n\nProduct: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://vairis-ten.vercel.app"}/product/${product.id}`,
  );

  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;
    const onScroll = () => {
      const slideWidth = el.clientWidth;
      if (slideWidth <= 0) return;
      const index = Math.round(el.scrollLeft / slideWidth);
      setActiveThumb(Math.min(index, gallery.length - 1));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [gallery.length]);

  const scrollToSlide = (index: number) => {
    setActiveThumb(index);
    swipeRef.current?.scrollTo({ left: index * (swipeRef.current.clientWidth ?? 0), behavior: "smooth" });
  };

  return (
    <PageShell
      {...pageLayouts.pdp}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: categoryLabel, href: categoryHref },
        { label: product.name },
      ]}
    >
      <div className="pdp">
        <div className="pdp__gallery">
          {/* Mobile swipe gallery */}
          <div className="pdp__gallery-swipe" ref={swipeRef}>
            {gallery.map((src, i) => (
              <div key={src} className="pdp__gallery-slide">
                <ProductImage src={src} alt={`${product.name} view ${i + 1}`} fill />
              </div>
            ))}
          </div>
          {/* Thumbnail strip (desktop) */}
          {gallery.length > 1 && (
            <div className="pdp__thumbnails">
              {gallery.map((src, i) => (
                <button
                  key={src}
                  className={`pdp__thumb${i === activeThumb ? " pdp__thumb--active" : ""}`}
                  onClick={() => scrollToSlide(i)}
                  aria-label={`View image ${i + 1}`}
                >
                  <ProductImage src={src} alt="" fill />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pdp__info">
          {product.itemCode && (
            <p className="pdp__sku">{product.itemCode}</p>
          )}
          <h1 className="pdp__title">{product.name}</h1>
          <p className="pdp__category">{categoryLabel}</p>

          {product.designStyle && (
            <p className="pdp__style-note">{product.designStyle}</p>
          )}

          {product.description && (
            <p className="pdp__desc">{product.description}</p>
          )}

          {/* Variant selector */}
          {product.variants.length > 0 && (
            <div className="pdp__variants">
              <p className="pdp__variants-label">Metal</p>
              <div className="pdp__variants-list">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    className={`pdp__variant-btn${v.id === selectedVariantId ? " pdp__variant-btn--active" : ""}`}
                    onClick={() => setSelectedVariantId(v.id)}
                  >
                    {METAL_LABELS[v.metalType] ?? v.metalType}
                    {v.size ? ` — ${v.size}` : ""}
                  </button>
                ))}
              </div>
              {price != null && (
                <p className="pdp__price">
                  ₹{price.toLocaleString("en-IN")}
                  <span className="pdp__price-note"> incl. GST</span>
                </p>
              )}
            </div>
          )}

          {/* CTAs */}
          <div className="pdp__ctas">
            {product.comingSoon ? (
              <p className="pdp__coming-soon">Coming Soon — price not yet available</p>
            ) : (
              <>
                <a
                  href={`https://wa.me/917075486464?text=${whatsappText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary pdp__cta-whatsapp"
                >
                  Enquire on WhatsApp
                </a>
                <WishlistButton productId={product.id} productName={product.name} />
              </>
            )}
          </div>

          <CommerceTrustHelpPanel items={compareTrustItems} />
        </div>
      </div>

      <PdpStickyBar productName={product.name} onAddToBag={openCartModal} />
    </PageShell>
  );
}

export default function ProductPageClient(props: Props) {
  return (
    <CartModalProvider>
      <PdpContent {...props} />
    </CartModalProvider>
  );
}
```

- [ ] **Step 3: Update next.config with Google Drive remotePattern**

Open `APP/next.config.mjs` and add Google Drive to `remotePatterns`:

```javascript
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
    ],
  },
}
```

- [ ] **Step 4: Verify**

```bash
npm run dev
```

Pick a real Prisma product id: `npx prisma studio` or `SELECT id FROM "Product" LIMIT 1`.

Open `http://localhost:3000/product/[that-id]`. Verify:
- Product name and images render
- Variant buttons appear
- Selecting a variant updates the price
- WhatsApp link opens correct URL

- [ ] **Step 5: Commit**

```bash
cd "APP" && git add app/product/ lib/prisma-to-product.ts next.config.mjs
git commit -m "feat(ui-v2): PDP wired to Prisma with variant pricing + wireframe shell"
```

---

### Task 11: Wishlist page + real WishlistProvider

**Goal:** Wire WishlistProvider to the real `/api/wishlist` endpoint and migrate the wishlist page.

**Files:**
- Modify: `APP/components/commerce/WishlistProvider.tsx`
- Create: `APP/components/commerce/WishlistPageView.tsx`
- Create: `APP/app/wishlist/page.tsx`

**Acceptance Criteria:**
- [ ] Logged-out user: heart toggle saves to localStorage, wishlist page shows local items
- [ ] Logged-in user: heart toggle calls `POST /api/wishlist`, wishlist page shows DB items
- [ ] `http://localhost:3000/wishlist` renders without crash

**Steps:**

- [ ] **Step 1: Wire WishlistProvider to Supabase session + API**

Replace `APP/components/commerce/WishlistProvider.tsx` with:

```typescript
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createBrowserClient } from "@supabase/ssr";

const LOCAL_KEY = "vairis-wishlist-ids";

type WishlistContextValue = {
  ids: ReadonlySet<string>;
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => boolean;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

function loadLocal(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveLocal(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify([...ids]));
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    async function init() {
      const { data } = await supabase.auth.getSession();
      const loggedIn = !!data.session;
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
        // Fetch server wishlist
        const res = await fetch("/api/wishlist");
        if (res.ok) {
          const json = await res.json() as { productId: string }[];
          setIds(new Set(json.map((w) => w.productId)));
        }
      } else {
        setIds(loadLocal());
      }
      setHydrated(true);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (hydrated && !isLoggedIn) saveLocal(ids);
  }, [ids, hydrated, isLoggedIn]);

  const toggle = useCallback(
    (id: string) => {
      let added = false;
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          added = false;
        } else {
          next.add(id);
          added = true;
        }
        return next;
      });

      if (isLoggedIn) {
        // Fire-and-forget API call
        fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: id }),
        }).catch(console.error);
      }

      return added;
    },
    [isLoggedIn],
  );

  const has = useCallback((id: string) => ids.has(id), [ids]);

  const value = useMemo(
    () => ({ ids, count: ids.size, has, toggle }),
    [ids, has, toggle],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
```

- [ ] **Step 2: Copy and adapt WishlistPageView**

```bash
cp "WIRE/src/components/commerce/WishlistPageView.tsx" \
   "APP/components/commerce/WishlistPageView.tsx"
```

Open `APP/components/commerce/WishlistPageView.tsx` and apply:
1. Change `from "@/lib/catalogue"` → `from "@/lib/catalogue-ui"`
2. Change `from "@/lib/data"` → `from "@/lib/ui-data"`
3. Change product card link prefix: the `catalogueProducts.filter(...)` lookup uses catalogue `id`/`slug` but our wishlist stores Prisma product ids. Replace the product lookup logic:

```typescript
// Replace the products useMemo with a fetch from Prisma via API
// Since WishlistPageView is client-side, use useEffect to fetch:
const [products, setProducts] = useState<Product[]>([]);

useEffect(() => {
  if (ids.size === 0) { setProducts([]); return; }
  // Fetch product details for wishlisted ids from API
  fetch(`/api/products?ids=${[...ids].join(",")}`)
    .then((r) => r.json())
    .then((data: Product[]) => setProducts(data))
    .catch(() => setProducts([]));
}, [ids]);
```

If `/api/products?ids=` endpoint doesn't exist yet, create a simple one in Step 3.

- [ ] **Step 3: Extend products API to support ids filter**

Open `APP/app/api/products/route.ts`. Add ids query param support:

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");

  const where = idsParam
    ? { id: { in: idsParam.split(",") }, isActive: true }
    : { isActive: true };

  const products = await prisma.product.findMany({
    where,
    include: { variants: true },
    orderBy: { createdAt: "asc" },
  });

  const goldRates = await prisma.goldRate.findMany();

  const { prismaToProduct } = await import("@/lib/prisma-to-product");
  return Response.json(products.map((p, i) => prismaToProduct(p, goldRates, i)));
}
```

- [ ] **Step 4: Create wishlist page**

Create `APP/app/wishlist/page.tsx`:

```typescript
import { WishlistPageView } from "@/components/commerce/WishlistPageView";

export default function WishlistPage() {
  return <WishlistPageView />;
}
```

- [ ] **Step 5: Verify**

```bash
npm run dev
```

1. Sign out. Open `http://localhost:3000/all-products/rings`. Click a heart → product added to wishlist.
2. Open `http://localhost:3000/wishlist`. Verify product appears.
3. Sign in (`/auth/login`). Open wishlist again — should now show server-side wishlist.

- [ ] **Step 6: Commit**

```bash
cd "APP" && git add components/commerce/WishlistProvider.tsx \
  components/commerce/WishlistPageView.tsx app/wishlist/page.tsx app/api/products/route.ts
git commit -m "feat(ui-v2): wishlist page + WishlistProvider wired to Supabase + /api/wishlist"
```

---

### Task 12: Cart page (UI + basic API wiring)

**Goal:** Create a `/cart` page that shows cart items from the API and renders the wireframe's cart UI.

**Files:**
- Create: `APP/app/cart/page.tsx`

**Acceptance Criteria:**
- [ ] `http://localhost:3000/cart` renders without crash
- [ ] Logged-in user sees their cart items (from `/api/cart`)
- [ ] Logged-out user sees empty cart message

**Steps:**

- [ ] **Step 1: Copy wireframe cart page**

```bash
cp "WIRE/src/app/cart/page.tsx" "APP/app/cart/page.tsx"
```

- [ ] **Step 2: Review cart page imports**

Open `APP/app/cart/page.tsx`. Fix any `@/lib/catalogue` → `@/lib/catalogue-ui` imports.

The wireframe cart page likely uses mock data. Identify where cart items are sourced and note any mock patterns for later real-API wiring.

For now, the cart page renders correctly with empty state — full cart API wiring is deferred to the checkout tasks (post-Razorpay).

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Open `http://localhost:3000/cart`. Should render the cart page layout with empty state.

- [ ] **Step 4: Commit**

```bash
cd "APP" && git add app/cart/
git commit -m "feat(ui-v2): cart page UI (backend wiring deferred to Razorpay task)"
```

---

### Task 13: Checkout + order confirmation pages (UI only)

**Goal:** Create `/checkout` and `/order-confirmation` pages as UI placeholders.

**Files:**
- Create: `APP/app/checkout/page.tsx`
- Create: `APP/app/order-confirmation/page.tsx`

**Acceptance Criteria:**
- [ ] Both pages render without crash
- [ ] Checkout page shows the CheckoutHeader (from wireframe)
- [ ] Order confirmation shows the order summary shell

**Steps:**

- [ ] **Step 1: Copy pages**

```bash
cp "WIRE/src/app/checkout/page.tsx" "APP/app/checkout/page.tsx"
cp "WIRE/src/app/order-confirmation/page.tsx" "APP/app/order-confirmation/page.tsx"
```

- [ ] **Step 2: Fix imports**

```bash
grep -n '@/lib/catalogue[^-]' "APP/app/checkout/page.tsx" "APP/app/order-confirmation/page.tsx" 2>/dev/null
```

Replace any stale imports.

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Open `http://localhost:3000/checkout` and `http://localhost:3000/order-confirmation`.

- [ ] **Step 4: Commit**

```bash
cd "APP" && git add app/checkout/ app/order-confirmation/
git commit -m "feat(ui-v2): checkout + order confirmation pages (UI placeholders)"
```

---

### Task 14: Contact + Returns pages

**Goal:** Create `/contact` and `/returns` pages.

**Files:**
- Create: `APP/app/contact/page.tsx`
- Create: `APP/app/returns/page.tsx`

**Acceptance Criteria:**
- [ ] Both pages render with correct header/footer
- [ ] Returns page shows the accordion-based returns policy

**Steps:**

- [ ] **Step 1: Copy pages**

```bash
cp "WIRE/src/app/contact/page.tsx" "APP/app/contact/page.tsx"
cp "WIRE/src/app/returns/page.tsx" "APP/app/returns/page.tsx"
```

- [ ] **Step 2: Fix imports and verify**

```bash
npm run dev
```

Open `http://localhost:3000/contact` and `http://localhost:3000/returns`.

- [ ] **Step 3: Commit**

```bash
cd "APP" && git add app/contact/ app/returns/
git commit -m "feat(ui-v2): contact and returns pages"
```

---

### Task 15: Remove old store routes + add redirects

**Goal:** Clean up the legacy `/shop` routes and ensure old bookmarks redirect to new URLs.

**Files:**
- Delete: `APP/app/(store)/shop/**`, `APP/app/(store)/layout.tsx`
- Delete: `APP/components/store/Navbar.tsx`, `APP/components/store/HeroCarousel.tsx`, `APP/components/store/ProductCard.tsx`, `APP/components/store/MediaGallery.tsx`, `APP/components/store/GoldRateBanner.tsx`
- Modify: `APP/next.config.mjs` — add redirects

**Acceptance Criteria:**
- [ ] `http://localhost:3000/shop/rings` redirects (301) to `/all-products/rings`
- [ ] `http://localhost:3000/shop/product/[id]` redirects to `/product/[id]`
- [ ] `http://localhost:3000/shop` redirects to `/all-products/rings`
- [ ] No TypeScript errors from deleted files

**Steps:**

- [ ] **Step 1: Add redirects to next.config.mjs**

Open `APP/next.config.mjs` and add `redirects()`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/shop',
        destination: '/all-products/rings',
        permanent: true,
      },
      {
        source: '/shop/:category',
        destination: '/all-products/:category',
        permanent: true,
      },
      {
        source: '/shop/product/:id',
        destination: '/product/:id',
        permanent: true,
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 2: Delete old store pages and components**

```bash
rm -rf "APP/app/(store)"
rm -f "APP/components/store/Navbar.tsx" \
      "APP/components/store/HeroCarousel.tsx" \
      "APP/components/store/ProductCard.tsx" \
      "APP/components/store/MediaGallery.tsx" \
      "APP/components/store/GoldRateBanner.tsx"
```

- [ ] **Step 3: Delete old account page if now handled by auth**

Check `APP/app/(store)/account/page.tsx` — if it has functionality not yet replicated in the new UI (account settings etc.), move it to `APP/app/account/page.tsx` before deleting. The wireframe doesn't have an account page — create a minimal one:

Create `APP/app/account/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { pageLayouts } from "@/lib/layout-config";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <PageShell {...pageLayouts.contact}>
      <Container>
        <div style={{ paddingBlock: "var(--section-gap)" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem" }}>My Account</h1>
          <p style={{ marginTop: "1rem", color: "var(--color-text-secondary)" }}>{user.email}</p>
        </div>
      </Container>
    </PageShell>
  );
}
```

- [ ] **Step 4: TS check**

```bash
cd "APP" && npx tsc --noEmit 2>&1 | grep -v node_modules | head -30
```

Fix any remaining errors (typically: imports in deleted files that other modules depended on).

- [ ] **Step 5: Verify redirects**

```bash
npm run dev
```

Open `http://localhost:3000/shop/rings` — should redirect to `/all-products/rings`.
Open `http://localhost:3000/shop` — should redirect to `/all-products/rings`.

- [ ] **Step 6: Commit**

```bash
cd "APP" && git add next.config.mjs app/account/
git rm -r "app/(store)" \
   "components/store/Navbar.tsx" "components/store/HeroCarousel.tsx" \
   "components/store/ProductCard.tsx" "components/store/MediaGallery.tsx" \
   "components/store/GoldRateBanner.tsx" 2>/dev/null || true
git commit -m "feat(ui-v2): remove old /shop routes, add redirects, add account page stub"
```

---

### Task 16: Admin pages CSS compatibility

**Goal:** Ensure the admin pages still function under the new CSS setup. Admin doesn't need the full wireframe UI — just no crashes.

**Files:**
- Modify: `APP/app/(admin)/layout.tsx`

**Acceptance Criteria:**
- [ ] `http://localhost:3000/admin/products` loads without blank page
- [ ] Product list, edit, and new product forms work
- [ ] No new 500 errors

**Steps:**

- [ ] **Step 1: Check admin layout**

Open `APP/app/(admin)/layout.tsx`. If it imports Tailwind-specific components (like the old `Navbar`), remove those imports.

- [ ] **Step 2: Add minimal admin CSS reset**

At the top of `APP/app/(admin)/layout.tsx`, ensure it has its own body styling so it doesn't inherit conflicting CSS from the wireframe token system. Add an inline `<style>` or a separate `admin.css` that resets font and background for admin:

```typescript
// In the admin layout, add a className to <main> or a wrapper:
// className="admin-shell"
// Then add to APP/styles/components.css or a new file:
// .admin-shell { font-family: system-ui, sans-serif; background: #fff; color: #111; }
```

Or simply add to `APP/styles/components.css`:

```css
.admin-shell {
  font-family: system-ui, -apple-system, sans-serif;
  background: #ffffff;
  color: #111111;
  min-height: 100vh;
  padding: 1.5rem;
}
```

- [ ] **Step 3: Verify admin**

```bash
npm run dev
```

Visit `http://localhost:3000/auth/admin` → sign in as admin → visit `/admin/products`. Verify list renders.

- [ ] **Step 4: Commit**

```bash
cd "APP" && git add app/(admin)/ styles/
git commit -m "feat(ui-v2): admin CSS compatibility under new token system"
```

---

### Task 17: Final build + smoke test

**Goal:** Ensure the full production build succeeds and all critical pages work end-to-end.

**Files:** none (build verification)

**Acceptance Criteria:**
- [ ] `npm run build` exits 0
- [ ] All pages below return HTTP 200 in production build: `/`, `/all-products/rings`, `/all-products/earrings`, `/product/[real-id]`, `/wishlist`, `/cart`, `/checkout`, `/contact`, `/returns`, `/auth/login`, `/admin/products`
- [ ] No Prisma or Supabase connection errors in build log
- [ ] Theme toggle persists across page navigations

**Steps:**

- [ ] **Step 1: Run production build**

```bash
cd "APP" && npm run build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` or equivalent. Fix any TS errors or missing imports shown.

- [ ] **Step 2: Start production server and smoke test**

```bash
npm run start &
sleep 3
```

Test each URL listed in Acceptance Criteria.

- [ ] **Step 3: Theme toggle test**

Visit `/`. Toggle dark mode. Navigate to `/all-products/rings`. Verify dark mode persists.

- [ ] **Step 4: Final commit**

```bash
cd "APP" && git add -A
git commit -m "feat(ui-v2): production build verified, UI-v2 migration complete"
```

---

## Self-Review Against Spec

**Spec requirements vs tasks:**

| Requirement | Task |
|---|---|
| Create `UI-v2` branch | Task 0 |
| Upgrade Next 16 + React 19 | Task 1 |
| Remove Tailwind, adopt CSS tokens | Tasks 2, 3 |
| Copy wireframe UI components | Tasks 4, 5, 8 |
| Home page migration | Task 7 |
| PLP migration with real Prisma data | Task 9 |
| PDP migration with real Prisma data + pricing | Task 10 |
| Wishlist wired to /api/wishlist | Task 11 |
| Cart UI (no backend wiring) | Task 12 |
| Checkout + order confirmation UI | Task 13 |
| Contact + Returns pages | Task 14 |
| Dark/light theme toggle | Tasks 4, 5 |
| Keep admin working | Task 16 |
| Old URL redirects | Task 15 |
| Build verification | Task 17 |

**Auth note:** The wireframe's OTP-based `AuthProvider` is copied but wired to the existing Supabase auth pages (`/auth/login`) via `HeaderAccountButton`. Full OTP popover wiring to Supabase `signInWithOtp` is a future enhancement — the decision to keep existing email/password flow avoids breaking changes to existing admin accounts.

**Known gaps to handle during execution:**
1. `APP/components/layout/HeaderWishlistLink.tsx` — check if it reads wishlist count from `useWishlist()`; it should work automatically with the new provider.
2. The wireframe `CategoryPageView` pagination — verify it works when `prismaProducts` override is provided (the `getCategoryProducts` fallback path must be bypassed).
3. `APP/lib/pricing.ts` `calculatePrice` function signature — verify it matches the call in `prisma-to-product.ts` before running Task 9.
4. `WIRE/public/scripts/vairis-theme-init.js` — if this file doesn't exist in WIRE, the inline version provided in Task 5 must be used.
