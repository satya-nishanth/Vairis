import { test, expect, type Page } from '@playwright/test'

// ─── helpers ───────────────────────────────────────────────────────────────

const ADMIN = { email: 'nish99.sn@gmail.com', password: 'Admin1234!' }

async function loginAsAdmin(page: Page) {
  await page.goto('/auth/admin')
  await page.waitForLoadState('networkidle')
  await page.locator('input[name="email"]').fill(ADMIN.email)
  await page.locator('input[name="password"]').fill(ADMIN.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 })
}

async function loginAsUser(page: Page) {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input[name="email"]').first().fill(ADMIN.email)
  await page.locator('input[name="password"]').first().fill(ADMIN.password)
  await page.locator('button[type="submit"]', { hasText: 'Sign In' }).click()
  // Redirect to / (not admin dashboard — that's the fix we made)
  await page.waitForURL(/^http:\/\/localhost:3000\/?$/, { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

// ─── test state ────────────────────────────────────────────────────────────

let testProductId = ''

// ─── suite ─────────────────────────────────────────────────────────────────

test.describe('Customer login & wishlist flows', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAsAdmin(page)

    const res = await page.request.post('/api/admin/products', {
      data: {
        name: 'E2E Wishlist Ring',
        description: 'E2E test product for wishlist',
        category: 'RINGS',
        itemCode: 'E2E-WL-001',
        isActive: true,
        comingSoon: true,
        images: [],
        variants: [
          {
            metalType: 'GOLD_18K',
            weightGrams: '3.5',
            makingChargePerGram: '0',
            stoneCharges: '0',
            miscCharges: '45',
            stock: '0',
            sku: 'E2E-WL-001-G18K',
          },
        ],
      },
    })

    if (res.ok()) {
      const data = await res.json()
      testProductId = data.id
    }
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    if (!testProductId) return
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await loginAsAdmin(page)
      await page.request.delete(`/api/wishlist?productId=${testProductId}`)
      await page.request.delete(`/api/admin/products/${testProductId}`)
    } catch { /* best-effort */ } finally {
      await context.close()
    }
  })

  // ─── 1. Customer login page ───────────────────────────────────────────────

  test('1. /auth/login is customer-facing with brand design', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    // VAIRIS on login page is now an img (vairis_main.jpeg), not h1
    await expect(page.locator('img[alt="VAIRIS Fine Jewellery"], img[alt="VAIRIS"]').first()).toBeVisible()
    await expect(page.locator('h2', { hasText: 'Welcome back' })).toBeVisible()
    await expect(page.locator('input[name="email"]').first()).toBeVisible()
    await expect(page.locator('input[name="password"]').first()).toBeVisible()
    await expect(page.locator('button[type="submit"]', { hasText: 'Sign In' })).toBeVisible()
    await expect(page.locator('a[href="/auth/admin"]')).toBeVisible()
  })

  test('2. customer sign-in lands on / not /admin/dashboard', async ({ page }) => {
    await loginAsUser(page)
    expect(page.url()).toMatch(/^http:\/\/localhost:3000\/?$/)
  })

  // ─── 2. Logged-in wishlist ────────────────────────────────────────────────

  test('3. logged-in: Notify Me button visible on coming-soon PDP', async ({ page }) => {
    test.skip(!testProductId, 'Requires test product')

    await loginAsUser(page)

    // Clear any leftover wishlist entry for clean state
    await page.request.delete(`/api/wishlist?productId=${testProductId}`)

    await page.goto(`/shop/product/${testProductId}`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=Coming Soon').first()).toBeVisible()

    // Wait for React hydration + useEffect wishlist-check to complete
    await page.waitForTimeout(2000)

    // Should show idle button (we cleared wishlist above)
    const notifyBtn = page.getByTestId('notify-me-button')
    await expect(notifyBtn).toBeVisible({ timeout: 5000 })
  })

  test('4. click Notify Me → success state shown', async ({ page }) => {
    test.skip(!testProductId, 'Requires test product')

    await loginAsUser(page)
    await page.request.delete(`/api/wishlist?productId=${testProductId}`)

    await page.goto(`/shop/product/${testProductId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const notifyBtn = page.getByTestId('notify-me-button')
    await expect(notifyBtn).toBeVisible({ timeout: 5000 })
    await notifyBtn.click()

    await expect(page.getByTestId('notify-success')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('a', { hasText: 'View your wishlist' })).toBeVisible()
  })

  test('5. wishlisted product visible on /wishlist', async ({ page }) => {
    test.skip(!testProductId, 'Requires test product + test 4 to run first')

    await loginAsUser(page)
    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1', { hasText: 'My Wishlist' })).toBeVisible()
    await expect(page.locator('text=E2E Wishlist Ring')).toBeVisible()
    await expect(page.locator('text=Coming Soon').first()).toBeVisible()
  })

  test('6. remove button removes product from wishlist', async ({ page }) => {
    test.skip(!testProductId, 'Requires product in wishlist')

    await loginAsUser(page)
    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=E2E Wishlist Ring')).toBeVisible()

    await page.getByTestId('wishlist-remove').first().click()

    // router.refresh() causes re-render — product should disappear
    await expect(page.locator('text=E2E Wishlist Ring')).not.toBeVisible({ timeout: 6000 })
  })

  // ─── 3. Unauthenticated → wishlist → login ────────────────────────────────

  test('7. unauthed Notify Me → /auth/login with ?next= param', async ({ page }) => {
    test.skip(!testProductId, 'Requires test product')

    await page.context().clearCookies()
    await page.goto(`/shop/product/${testProductId}`)
    await page.waitForLoadState('networkidle')

    // Wait for useEffect to settle (no session → stays idle)
    await page.waitForTimeout(1500)

    const notifyBtn = page.getByTestId('notify-me-button')
    await expect(notifyBtn).toBeVisible()
    await notifyBtn.click()

    await page.waitForURL(/\/auth\/login\?next=/, { timeout: 8000 })

    // URL contains ?next= pointing to our PDP
    expect(page.url()).toContain('next=')
    expect(decodeURIComponent(page.url())).toContain(`/shop/product/${testProductId}`)

    // Customer-facing login page (not admin)
    await expect(page.locator('h2', { hasText: 'Welcome back' })).toBeVisible()
  })

  test('8. full flow: unauthed → Notify Me → login → PDP → wishlisted → /wishlist', async ({
    page,
  }) => {
    test.skip(!testProductId, 'Requires test product')

    // Step 1: Start unauthenticated, clear any stale wishlist data
    await page.context().clearCookies()

    const pdpUrl = `/shop/product/${testProductId}`

    // Step 2: Go to PDP
    await page.goto(pdpUrl)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500) // let useEffect settle

    // Step 3: Click Notify Me → redirected to login
    await page.getByTestId('notify-me-button').click()
    await page.waitForURL(/\/auth\/login\?next=/, { timeout: 8000 })

    // Step 4: Sign in on customer login page
    await page.locator('input[name="email"]').first().fill(ADMIN.email)
    await page.locator('input[name="password"]').first().fill(ADMIN.password)
    await page.locator('button[type="submit"]', { hasText: 'Sign In' }).click()

    // Step 5: Redirected back to PDP via ?next param
    await page.waitForURL(`**${pdpUrl}`, { timeout: 15000 })
    await page.waitForLoadState('networkidle')

    // Clean up any pre-existing wishlist entry so we can click the button
    await page.request.delete(`/api/wishlist?productId=${testProductId}`)

    // Step 6: Wait for useEffect to re-check wishlist state
    await page.waitForTimeout(2000)

    // Should show idle button (cleared above)
    const notifyBtn = page.getByTestId('notify-me-button')
    const notifySuccess = page.getByTestId('notify-success')

    const alreadyDone = await notifySuccess.isVisible().catch(() => false)
    if (!alreadyDone) {
      await expect(notifyBtn).toBeVisible({ timeout: 5000 })
      await notifyBtn.click()
    }

    // Step 7: Verify success
    await expect(notifySuccess).toBeVisible({ timeout: 8000 })

    // Step 8: Navigate to /wishlist
    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1', { hasText: 'My Wishlist' })).toBeVisible()
    await expect(page.locator('text=E2E Wishlist Ring')).toBeVisible()
  })

  // ─── 4. Unauthed /wishlist redirect ───────────────────────────────────────

  test('9. /wishlist without login redirects to /auth/login?next=/wishlist', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/auth\/login/)
    // next param contains /wishlist (server redirect doesn't URL-encode it)
    expect(page.url()).toContain('next=/wishlist')
  })
})
