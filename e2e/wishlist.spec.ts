import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

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
  // Customer login page has Sign In as first submit button
  await page.locator('input[name="email"]').first().fill(ADMIN.email)
  await page.locator('input[name="password"]').first().fill(ADMIN.password)
  await page.locator('button[type="submit"]', { hasText: 'Sign In' }).click()
  await page.waitForURL(/^(?!.*auth).*$/, { timeout: 15000 }) // not on /auth/
  await page.waitForLoadState('networkidle')
}

async function createComingSoonProduct(request: APIRequestContext, authCookies: any[]) {
  const body = {
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
  }
  const res = await request.post('/api/admin/products', {
    data: body,
  })
  if (!res.ok()) {
    const text = await res.text()
    throw new Error(`Failed to create product: ${res.status()} ${text}`)
  }
  const product = await res.json()
  return product.id as string
}

async function deleteProduct(request: APIRequestContext, productId: string) {
  await request.delete(`/api/admin/products/${productId}`)
}

async function clearWishlist(request: APIRequestContext, productId: string) {
  await request.delete(`/api/wishlist?productId=${productId}`)
}

// ─── test state ───────────────────────────────────────────────────────────

let testProductId = ''

// ─── suite ────────────────────────────────────────────────────────────────

test.describe('Customer login & wishlist flows', () => {
  // Create test product as admin before all tests
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAsAdmin(page)

    // Use the page's request context — it has the admin session cookies
    const product = await page.request.post('/api/admin/products', {
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

    if (product.ok()) {
      const data = await product.json()
      testProductId = data.id
    }
    await context.close()
  })

  // Clean up product + wishlist after all tests
  test.afterAll(async ({ browser }) => {
    if (!testProductId) return
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await loginAsAdmin(page)
      // Remove wishlist entries first, then product
      await page.request.delete(`/api/wishlist?productId=${testProductId}`)
      await page.request.delete(`/api/admin/products/${testProductId}`)
    } catch {
      // best-effort cleanup
    } finally {
      await context.close()
    }
  })

  // ─── Test 1: Customer login page ─────────────────────────────────────────

  test('customer /auth/login page is attractive and works', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    // Brand-first: VAIRIS heading visible (desktop split or mobile)
    await expect(page.locator('h1', { hasText: 'VAIRIS' }).first()).toBeVisible()

    // "Welcome back" heading
    await expect(page.locator('h2', { hasText: 'Welcome back' })).toBeVisible()

    // Form inputs
    await expect(page.locator('input[name="email"]').first()).toBeVisible()
    await expect(page.locator('input[name="password"]').first()).toBeVisible()
    await expect(page.locator('button[type="submit"]', { hasText: 'Sign In' })).toBeVisible()

    // Link to admin login (for misdirected admins)
    await expect(page.locator('a[href="/auth/admin"]')).toBeVisible()

    // "Create an account" option
    await expect(page.locator('text=New here?')).toBeVisible()
  })

  test('customer can sign in and reaches homepage (not admin dashboard)', async ({ page }) => {
    await loginAsUser(page)
    // Should land on / or whatever next param says — NOT /admin/dashboard
    expect(page.url()).not.toContain('/admin/dashboard')
    expect(page.url()).not.toContain('/auth/login')
  })

  // ─── Test 2: Logged-in user wishlist flow ────────────────────────────────

  test('logged-in user: PDP shows Notify Me, click saves to wishlist', async ({ page }) => {
    test.skip(!testProductId, 'Requires test product (beforeAll)')

    await loginAsUser(page)

    // Navigate to PDP of coming-soon product
    await page.goto(`/shop/product/${testProductId}`)
    await page.waitForLoadState('networkidle')

    // "Coming Soon" badge visible
    await expect(page.locator('text=Coming Soon').first()).toBeVisible()

    // "Notify Me" button visible
    const notifyBtn = page.getByTestId('notify-me-button')
    await expect(notifyBtn).toBeVisible()

    // Click it
    await notifyBtn.click()

    // Success state shown
    await expect(page.getByTestId('notify-success')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('text=We\'ll notify you')).toBeVisible()

    // "View your wishlist" link visible
    await expect(page.locator('a', { hasText: 'View your wishlist' })).toBeVisible()
  })

  test('wishlisted product appears on /wishlist page', async ({ page }) => {
    test.skip(!testProductId, 'Requires test product + previous test to wishlist it')

    await loginAsUser(page)
    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')

    // Wishlist page heading
    await expect(page.locator('h1', { hasText: 'My Wishlist' })).toBeVisible()

    // Our test product should be visible
    await expect(page.locator('text=E2E Wishlist Ring')).toBeVisible()

    // Coming Soon badge on wishlist card
    await expect(page.locator('text=Coming Soon').first()).toBeVisible()
  })

  test('remove button removes product from wishlist', async ({ page }) => {
    test.skip(!testProductId, 'Requires test product in wishlist')

    await loginAsUser(page)
    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')

    // Verify product is there
    await expect(page.locator('text=E2E Wishlist Ring')).toBeVisible()

    // Click remove
    const removeBtn = page.getByTestId('wishlist-remove').first()
    await removeBtn.click()

    // After router.refresh(), product should be gone
    await expect(page.locator('text=E2E Wishlist Ring')).not.toBeVisible({ timeout: 5000 })
  })

  // ─── Test 3: Unauthenticated → wishlist → login → wishlisted ─────────────

  test('unauthenticated: Notify Me → redirects to login with ?next param', async ({ page }) => {
    test.skip(!testProductId, 'Requires test product')

    // Fresh context — no session
    await page.context().clearCookies()

    await page.goto(`/shop/product/${testProductId}`)
    await page.waitForLoadState('networkidle')

    // Notify Me should be visible (coming soon product)
    const notifyBtn = page.getByTestId('notify-me-button')
    await expect(notifyBtn).toBeVisible()

    // Click — should redirect to login
    await notifyBtn.click()
    await page.waitForURL(/\/auth\/login\?next=/, { timeout: 8000 })

    // URL contains ?next= pointing back to our PDP
    expect(page.url()).toContain(`next=`)
    expect(page.url()).toContain(encodeURIComponent(`/shop/product/${testProductId}`))

    // Login page is the customer-facing one (VAIRIS heading, Welcome back)
    await expect(page.locator('h2', { hasText: 'Welcome back' })).toBeVisible()
  })

  test('full flow: unauthenticated → Notify Me → login → back to PDP → wishlisted → visible in /wishlist', async ({
    page,
  }) => {
    test.skip(!testProductId, 'Requires test product')

    // Step 1: Start unauthenticated
    await page.context().clearCookies()

    // Step 2: Go to PDP
    const pdpUrl = `/shop/product/${testProductId}`
    await page.goto(pdpUrl)
    await page.waitForLoadState('networkidle')

    // Step 3: Click Notify Me → redirected to login
    await page.getByTestId('notify-me-button').click()
    await page.waitForURL(/\/auth\/login\?next=/, { timeout: 8000 })

    // Step 4: Sign in on customer login page
    await page.locator('input[name="email"]').first().fill(ADMIN.email)
    await page.locator('input[name="password"]').first().fill(ADMIN.password)
    await page.locator('button[type="submit"]', { hasText: 'Sign In' }).click()

    // Step 5: Redirected back to PDP (via ?next param)
    await page.waitForURL(`**${pdpUrl}`, { timeout: 15000 })
    await page.waitForLoadState('networkidle')

    // Step 6: NotifyMeButton is on PDP — either idle or already done (if mount-check runs)
    // Wait for mount-check to resolve
    await page.waitForTimeout(1500)

    const notifyBtn = page.getByTestId('notify-me-button')
    const notifySuccess = page.getByTestId('notify-success')

    // If mount-check already shows "done" (was saved from previous test), proceed
    // Otherwise click the button
    const successVisible = await notifySuccess.isVisible().catch(() => false)
    if (!successVisible) {
      await expect(notifyBtn).toBeVisible()
      await notifyBtn.click()
      await expect(notifySuccess).toBeVisible({ timeout: 8000 })
    }

    await expect(page.locator('text=We\'ll notify you')).toBeVisible()

    // Step 7: Navigate to /wishlist
    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')

    // Step 8: Verify product is there
    await expect(page.locator('h1', { hasText: 'My Wishlist' })).toBeVisible()
    await expect(page.locator('text=E2E Wishlist Ring')).toBeVisible()
  })

  // ─── Test 4: Unauthenticated /wishlist redirects to login ─────────────────

  test('visiting /wishlist without login redirects to /auth/login?next=/wishlist', async ({
    page,
  }) => {
    await page.context().clearCookies()
    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/auth\/login/)
    await expect(page.url()).toContain('next=%2Fwishlist')
  })
})
