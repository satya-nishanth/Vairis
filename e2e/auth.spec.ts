import { test, expect } from '@playwright/test'

test.describe('Auth flows', () => {
  test('/auth/login shows VAIRIS heading and email/password form', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1', { hasText: 'VAIRIS' })).toBeVisible()
    await expect(page.locator('input[name="email"]').first()).toBeVisible()
    await expect(page.locator('input[name="password"]').first()).toBeVisible()
    await expect(page.locator('button[type="submit"]', { hasText: 'Sign In' })).toBeVisible()
  })

  test('Submitting wrong credentials shows error in URL (?error=...)', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    await page.locator('input[name="email"]').first().fill('wrong@example.com')
    await page.locator('input[name="password"]').first().fill('wrongpassword')
    await page.locator('button[type="submit"]', { hasText: 'Sign In' }).click()

    // Server Action redirects back with ?error= on bad credentials
    await page.waitForURL(/\/auth\/login\?error=/)
    await expect(page).toHaveURL(/error=/)

    // The error message should be visible on the page
    await expect(page.locator('p').filter({ hasText: /invalid/i }).or(
      page.locator('p').filter({ hasText: /error/i }).or(
        page.locator('p').filter({ hasText: /credential/i })
      )
    ).first()).toBeVisible()
  })

  test('/admin/dashboard without login redirects to /auth/login', async ({ page }) => {
    // Use a fresh context without any stored cookies
    await page.context().clearCookies()
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('Successful login lands on /admin/dashboard', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    await page.locator('input[name="email"]').first().fill('nish99.sn@gmail.com')
    await page.locator('input[name="password"]').first().fill('Admin1234!')
    await page.locator('button[type="submit"]', { hasText: 'Sign In' }).click()

    // Successful login redirects to /admin/dashboard
    await page.waitForURL('**/admin/dashboard', { timeout: 15000 })
    await expect(page).toHaveURL(/\/admin\/dashboard/)
  })
})
