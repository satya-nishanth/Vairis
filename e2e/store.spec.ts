import { test, expect } from '@playwright/test'

test.describe('Public store flows', () => {
  test('Homepage loads with VAIRIS heading and Explore Collection link', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1', { hasText: 'VAIRIS' })).toBeVisible()
    await expect(page.locator('a', { hasText: 'Explore Collection' })).toBeVisible()
    await expect(page.locator('a', { hasText: 'Explore Collection' })).toHaveAttribute(
      'href',
      '/shop'
    )
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

  test('Clicking a category pill on /shop navigates to that category URL', async ({ page }) => {
    await page.goto('/shop')
    await page.waitForLoadState('networkidle')

    // Click the Rings filter pill — it navigates to /shop?category=rings
    await page.locator('a', { hasText: 'Rings' }).first().click()
    await page.waitForLoadState('networkidle')

    // The URL should contain the rings category query param
    await expect(page).toHaveURL(/category=rings/i)
    // The heading should now say Rings
    await expect(page.locator('h1', { hasText: 'Rings' })).toBeVisible()
  })

  test('/shop/product/[nonexistent-id] returns 404 page', async ({ page }) => {
    const response = await page.goto('/shop/product/00000000-0000-0000-0000-000000000000')
    // Next.js notFound() returns a 404 status
    expect(response?.status()).toBe(404)
  })
})
