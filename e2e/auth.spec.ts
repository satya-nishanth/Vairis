import { test, expect } from '@playwright/test'

test.describe('Customer login page (/auth/login)', () => {
  test('shows VAIRIS heading and email/password form', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    // Brand heading visible
    await expect(page.locator('h1', { hasText: 'VAIRIS' }).first()).toBeVisible()
    await expect(page.locator('input[name="email"]').first()).toBeVisible()
    await expect(page.locator('input[name="password"]').first()).toBeVisible()
    await expect(page.locator('button[type="submit"]', { hasText: 'Sign In' })).toBeVisible()
  })

  test('shows link to admin login', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('a[href="/auth/admin"]')).toBeVisible()
  })

  test('wrong credentials shows error', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')
    await page.locator('input[name="email"]').first().fill('nobody@example.com')
    await page.locator('input[name="password"]').first().fill('wrongpassword')
    await page.locator('button[type="submit"]', { hasText: 'Sign In' }).click()
    await page.waitForURL(/\/auth\/login\?error=/)
    await expect(page).toHaveURL(/error=/)
  })
})

test.describe('Admin login page (/auth/admin)', () => {
  test('shows Admin Portal heading and unauthorized warning', async ({ page }) => {
    await page.goto('/auth/admin')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1', { hasText: 'Admin Portal' })).toBeVisible()
    await expect(page.locator('text=Authorised personnel only')).toBeVisible()
    await expect(page.locator('a', { hasText: 'Return to store' })).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
  })

  test('wrong credentials shows error', async ({ page }) => {
    await page.goto('/auth/admin')
    await page.waitForLoadState('networkidle')
    await page.locator('input[name="email"]').fill('wrong@example.com')
    await page.locator('input[name="password"]').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/auth\/admin\?error=/)
    await expect(page).toHaveURL(/error=/)
  })

  test('/admin/dashboard without login redirects to /auth/admin', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/auth\/admin/)
  })

  test('successful admin login lands on /admin/dashboard', async ({ page }) => {
    await page.goto('/auth/admin')
    await page.waitForLoadState('networkidle')
    await page.locator('input[name="email"]').fill('nish99.sn@gmail.com')
    await page.locator('input[name="password"]').fill('Admin1234!')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 })
    await expect(page).toHaveURL(/\/admin\/dashboard/)
  })
})
