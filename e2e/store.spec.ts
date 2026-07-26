import { test, expect } from '@playwright/test'
import { CATEGORY_LABELS, HEADER_NAV_CATEGORIES } from '../lib/catalogue-ui'

// Categories with at least one LIVE, active product at test-write time — used
// for the product-card click-through, which needs a real card to click.
// Everything else is asserted via the (always-present) empty state, so this
// suite never depends on which categories happen to be seeded.
const SEEDED_CATEGORY = 'rings'

test.describe('Public store flows', () => {
  test('Homepage loads with brand logo and category carousel', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('img[alt="VAIRIS - Everyday Diamond Wear"]').first()).toBeVisible({ timeout: 8000 })
    // Homepage renders the category carousel twice — a mobile-only compact
    // version and a desktop-only marquee version (CSS toggles visibility) —
    // scope to the desktop one, which is what's actually visible at
    // Playwright's default desktop viewport.
    await expect(
      page.locator('.section--shop-categories--desktop-only [aria-label="Shop by category"]'),
    ).toBeVisible({ timeout: 8000 })
  })

  test('Header nav links to every category in HEADER_NAV_CATEGORIES', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const nav = page.locator('nav.site-header__nav, nav[aria-label="Main"]').first()
    for (const slug of HEADER_NAV_CATEGORIES) {
      await expect(nav.locator(`a[href="/all-products/${slug}"]`)).toBeVisible()
    }
  })

  for (const slug of HEADER_NAV_CATEGORIES) {
    test(`/all-products/${slug} loads and breadcrumb shows "${CATEGORY_LABELS[slug].title}"`, async ({ page }) => {
      await page.goto(`/all-products/${slug}`)
      await page.waitForLoadState('networkidle')

      await expect(page.locator('.breadcrumbs__current')).toHaveText(CATEGORY_LABELS[slug].title)
      // Either real products render in the grid, or the honest "on their way"
      // empty state does — never a blank/broken page.
      const hasProducts = await page.locator('.plp-grid .product-card, .plp-grid [class*="product-card"]').count()
      if (hasProducts === 0) {
        await expect(page.locator('.plp-empty')).toBeVisible()
      } else {
        await expect(page.locator('.plp-grid').first()).toBeVisible()
      }
    })
  }

  test('Clicking a header nav link navigates to the matching PLP', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const nav = page.locator('nav.site-header__nav, nav[aria-label="Main"]').first()
    await nav.locator(`a[href="/all-products/${SEEDED_CATEGORY}"]`).click()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(new RegExp(`/all-products/${SEEDED_CATEGORY}$`))
    await expect(page.locator('.breadcrumbs__current')).toHaveText(CATEGORY_LABELS[SEEDED_CATEGORY].title)
  })

  test('Category carousel card navigates to its category PLP', async ({ page }) => {
    await page.goto('/')
    // The marquee track runs a continuous 140s CSS scroll animation (paused
    // only on :hover) — Playwright's click-stability check never settles
    // against a moving target, so freeze it for this interaction test.
    await page.addStyleTag({ content: '.category-carousel__track { animation: none !important; }' })
    await page.waitForLoadState('networkidle')

    // Scope to the desktop-visible marquee section — the mobile-only compact
    // carousel renders the same cards but is CSS-hidden at this viewport.
    const card = page.locator(
      `.section--shop-categories--desktop-only a.card-category[href="/all-products/${SEEDED_CATEGORY}"]`,
    ).first()
    await card.click()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(new RegExp(`/all-products/${SEEDED_CATEGORY}$`))
  })

  test('Product card on a seeded PLP opens the PDP', async ({ page }) => {
    await page.goto(`/all-products/${SEEDED_CATEGORY}`)
    await page.waitForLoadState('networkidle')

    const firstCard = page.locator('.plp-grid a[href^="/product/"]').first()
    test.skip((await firstCard.count()) === 0, `No LIVE product seeded in ${SEEDED_CATEGORY} right now`)

    await firstCard.click()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/product\//)

    // Price Breakup panel always renders on a real PDP (pricing v2)
    await expect(page.locator('summary', { hasText: 'Price Breakup' })).toBeVisible()
  })

  test('/all-products/not-a-real-category returns 404', async ({ page }) => {
    const response = await page.goto('/all-products/not-a-real-category')
    expect(response?.status()).toBe(404)
  })

  test('/product/[nonexistent-id] returns 404', async ({ page }) => {
    const response = await page.goto('/product/00000000-0000-0000-0000-000000000000')
    expect(response?.status()).toBe(404)
  })
})
