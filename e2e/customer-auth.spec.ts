import { test, expect, type Page } from '@playwright/test'

// ─── helpers ──────────────────────────────────────────────────────────────

const TEST_USER = {
  email: `e2e.customer.${Date.now()}@vairistest.com`,
  password: 'TestPass123!',
  newPassword: 'NewPass456!',
}

async function goToLogin(page: Page, mode = 'signin') {
  const url = mode === 'signin' ? '/auth/login' : `/auth/login?mode=${mode}`
  await page.goto(url)
  await page.waitForLoadState('domcontentloaded')
}

// ─── tests ─────────────────────────────────────────────────────────────────

test.describe('Customer auth flows — sign in / sign up / forgot password', () => {

  // ── Sign-in page renders correctly ──────────────────────────────────────

  test('sign-in page: tabs, form, forgot link visible', async ({ page }) => {
    await goToLogin(page)

    // Tabs — identified by href (unique, no ambiguity)
    await expect(page.locator('a[href="/auth/login"]')).toBeVisible()
    await expect(page.locator('a[href="/auth/login?mode=signup"]')).toBeVisible()

    // Sign-in form
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()

    // Forgot password link
    await expect(page.locator('a[href="/auth/login?mode=forgot"]')).toBeVisible()

    // Admin link
    await expect(page.locator('a[href="/auth/admin"]')).toBeVisible()
  })

  // ── Sign-up page renders correctly ──────────────────────────────────────

  test('create account page: shows sign-up form', async ({ page }) => {
    await goToLogin(page, 'signup')

    // "Create Account" tab is active — no <details> hidden behind
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible()

    // Both tabs still visible for navigation
    await expect(page.getByRole('link', { name: 'Sign In', exact: true })).toBeVisible()
  })

  // ── Tab switching ────────────────────────────────────────────────────────

  test('clicking Create Account tab switches to signup mode', async ({ page }) => {
    await goToLogin(page)
    await page.getByRole('link', { name: 'Create Account', exact: true }).click()
    await page.waitForURL(/mode=signup/)
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible()
  })

  test('clicking Sign In tab switches back from signup', async ({ page }) => {
    await goToLogin(page, 'signup')
    await page.getByRole('link', { name: 'Sign In', exact: true }).click()
    await page.waitForURL(/\/auth\/login$|\/auth\/login\?(?!mode=signup)/)
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  // ── Sign up new account ──────────────────────────────────────────────────

  test('sign up with new email → redirected to sign-in with success msg', async ({ page }) => {
    await goToLogin(page, 'signup')

    await page.locator('input[name="email"]').fill(TEST_USER.email)
    await page.locator('input[name="password"]').fill(TEST_USER.password)
    await page.getByRole('button', { name: 'Create Account' }).click()

    // Redirect to sign-in page with success message
    await page.waitForURL(/\/auth\/login\?msg=/, { timeout: 10000 })
    await expect(page.locator('text=Account created')).toBeVisible()
  })

  test('sign up with duplicate email → shows error', async ({ page }) => {
    await goToLogin(page, 'signup')

    // nish99.sn@gmail.com already exists
    await page.locator('input[name="email"]').fill('nish99.sn@gmail.com')
    await page.locator('input[name="password"]').fill('SomePass123!')
    await page.getByRole('button', { name: 'Create Account' }).click()

    await page.waitForURL(/mode=signup.*error=|error=.*mode=signup/, { timeout: 10000 })
    // Error message rendered
    await expect(page.locator('text=already').or(page.locator('text=registered')).or(page.locator('[class*=red]'))).toBeVisible()
  })

  // ── Sign in ──────────────────────────────────────────────────────────────

  test('sign in with valid credentials → lands on homepage', async ({ page }) => {
    await goToLogin(page)
    await page.locator('input[name="email"]').fill('nish99.sn@gmail.com')
    await page.locator('input[name="password"]').fill('Admin1234!')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL(/^http:\/\/localhost:3000\/?$/, { timeout: 15000 })
    expect(page.url()).not.toContain('/auth')
  })

  test('sign in wrong password → error shown, stays on login', async ({ page }) => {
    await goToLogin(page)
    await page.locator('input[name="email"]').fill('nish99.sn@gmail.com')
    await page.locator('input[name="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL(/\/auth\/login\?error=/, { timeout: 10000 })
    await expect(page.locator('[class*=red]')).toBeVisible()
  })

  // ── Forgot password ──────────────────────────────────────────────────────

  test('forgot password page renders correctly', async ({ page }) => {
    await goToLogin(page, 'forgot')

    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeVisible()
    await expect(page.getByRole('link', { name: /back to sign in/i })).toBeVisible()
  })

  test('forgot password: submit any email → shows check-your-email message', async ({ page }) => {
    await goToLogin(page, 'forgot')

    await page.locator('input[name="email"]').fill('nish99.sn@gmail.com')
    await page.getByRole('button', { name: 'Send Reset Link' }).click()

    // Always redirects with success msg regardless of email existence (security)
    await page.waitForURL(/\/auth\/login\?msg=/, { timeout: 10000 })
    await expect(page.locator('text=reset link').or(page.locator('text=inbox'))).toBeVisible()
  })

  test('forgot password: non-existent email → same success message (no info leak)', async ({ page }) => {
    await goToLogin(page, 'forgot')

    await page.locator('input[name="email"]').fill('notreal@example.com')
    await page.getByRole('button', { name: 'Send Reset Link' }).click()

    await page.waitForURL(/\/auth\/login\?msg=/, { timeout: 10000 })
    // Same message shown — not leaking whether email exists
    await expect(page.locator('text=reset link').or(page.locator('text=inbox'))).toBeVisible()
  })

  test('forgot password: back link returns to sign-in', async ({ page }) => {
    await goToLogin(page, 'forgot')
    await page.getByRole('link', { name: /back to sign in/i }).click()
    await page.waitForURL(/\/auth\/login(?!\?mode=forgot)/)
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  // ── Update password page ─────────────────────────────────────────────────

  test('update-password page: bad token shows error + new link offer', async ({ page }) => {
    // Navigate without a valid token
    await page.goto('/auth/update-password?token_hash=invalid&type=recovery')
    await page.waitForLoadState('domcontentloaded')

    // Wait for useEffect verification to complete
    await expect(page.locator('text=expired').or(page.locator('text=invalid'))).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('link', { name: /request new reset link/i })).toBeVisible()
  })

  test('update-password page: missing token shows error', async ({ page }) => {
    await page.goto('/auth/update-password')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('text=Invalid').or(page.locator('text=missing'))).toBeVisible({ timeout: 8000 })
  })
})
