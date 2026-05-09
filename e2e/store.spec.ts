import { test, expect } from '@playwright/test'

test.describe('Public store flows', () => {
  test('Homepage loads with VAIRIS in navbar and Shop by Category section', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    // Navbar logo is always visible (server-rendered)
    await expect(page.locator('img[alt="VAIRIS Fine Jewellery"]')).toBeVisible({ timeout: 8000 })
    // Category section heading (server-rendered, always present)
    await expect(page.locator('h2', { hasText: 'Shop by Category' })).toBeVisible({ timeout: 8000 })
  })

  test('/shop loads and shows category filter pills', async ({ page }) => {
    await page.goto('/shop')
    await page.waitForLoadState('networkidle')

    // All five filter pills must be visible
    for (const label of ['All', 'Rings', 'Earrings', 'Pendants', 'Bracelets']) {
      await expect(page.locator('a', { hasText: label }).first()).toBeVisible()
    }
  })

  test('/shop/rings loads and shows Rings heading', async ({ page }) => {
    await page.goto('/shop/rings')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1', { hasText: 'Rings' })).toBeVisible()
  })

  test('/shop/earrings loads and shows Earrings heading', async ({ page }) => {
    await page.goto('/shop/earrings')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1', { hasText: 'Earrings' })).toBeVisible()
  })

  test('/shop/pendants loads and shows Pendants heading', async ({ page }) => {
    await page.goto('/shop/pendants')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1', { hasText: 'Pendants' })).toBeVisible()
  })

  test('/shop/bracelets loads and shows Bracelets heading', async ({ page }) => {
    await page.goto('/shop/bracelets')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1', { hasText: 'Bracelets' })).toBeVisible()
  })

  test('Clicking a category pill on /shop navigates to /shop/rings', async ({ page }) => {
    await page.goto('/shop')
    await page.waitForLoadState('networkidle')

    // Filter pills all link to /shop/[category] — same as navbar
    const mainContent = page.locator('main, [class*="max-w-7xl"]').first()
    await mainContent.locator('a', { hasText: 'Rings' }).first().click()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/shop\/rings/)
    await expect(page.locator('h1', { hasText: 'Rings' })).toBeVisible()
  })

  test('/shop filter pills have active state on category pages', async ({ page }) => {
    await page.goto('/shop/earrings')
    await page.waitForLoadState('networkidle')

    // Earrings pill should have active styling (bg-brand-dark text-white)
    const earringsPill = page.locator('a[href="/shop/earrings"]').first()
    await expect(earringsPill).toHaveClass(/bg-brand-dark/)
  })

  test('/shop/product/[nonexistent-id] returns 404 page', async ({ page }) => {
    const response = await page.goto('/shop/product/00000000-0000-0000-0000-000000000000')
    // Next.js notFound() returns a 404 status
    expect(response?.status()).toBe(404)
  })
})
