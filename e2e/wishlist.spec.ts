import { test, expect, type Page } from '@playwright/test'

// ─── helpers ───────────────────────────────────────────────────────────────

const CUSTOMER = { email: 'nish99.sn@gmail.com', password: 'Admin1234!' }

async function loginAsAdmin(page: Page) {
  await page.goto('/auth/admin')
  await page.waitForLoadState('networkidle')
  await page.locator('input[name="email"]').fill(CUSTOMER.email)
  await page.locator('input[name="password"]').fill(CUSTOMER.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 })
}

async function loginAsUser(page: Page) {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input[name="email"]').first().fill(CUSTOMER.email)
  await page.locator('input[name="password"]').first().fill(CUSTOMER.password)
  await page.locator('button[type="submit"]', { hasText: 'Sign In' }).click()
  await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(/^http:\/\/localhost:3000\/?$/)
  await page.waitForLoadState('networkidle')
}

// ─── test state ────────────────────────────────────────────────────────────

let testProductId = ''
const PRODUCT_NAME = 'E2E Wishlist Ring'

// ─── suite ─────────────────────────────────────────────────────────────────

test.describe('Login & wishlist flows', () => {
  // Wishlist is now a public, guest-usable feature (localStorage for guests,
  // synced to the Wishlist table on login) — no login gate on the button or
  // the /wishlist page itself (see components/commerce/WishlistProvider.tsx).
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAsAdmin(page)

    const res = await page.request.post('/api/admin/products', {
      data: {
        name: PRODUCT_NAME,
        description: 'E2E test product for wishlist',
        category: 'RINGS',
        itemCode: `E2E-WL-${Date.now()}`,
        isActive: true,
        status: 'LIVE',
        images: [],
        variants: [
          {
            metalType: 'GOLD_18K',
            weightGrams: '3.5',
            makingChargePerGram: '300',
            stoneCharges: '0',
            miscCharges: '45',
            stock: '5',
            sku: `E2E-WL-${Date.now()}-G18K`,
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
    } catch {
      // best-effort
    } finally {
      await context.close()
    }
  })

  // ─── 1. Customer login page ─────────────────────────────────────────────

  test('1. /auth/login is customer-facing with brand design', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('img[alt="VAIRIS Fine Jewellery"]').first()).toBeVisible()
    await expect(page.locator('.auth-tab', { hasText: 'Sign In' })).toBeVisible()
    await expect(page.locator('input[name="email"]').first()).toBeVisible()
    await expect(page.locator('input[name="password"]').first()).toBeVisible()
    await expect(page.locator('button[type="submit"]', { hasText: 'Sign In' })).toBeVisible()
    await expect(page.locator('a[href="/auth/admin"]')).toBeVisible()
  })

  test('2. customer sign-in lands on / not /admin/dashboard', async ({ page }) => {
    await loginAsUser(page)
    expect(page.url()).toMatch(/^http:\/\/localhost:3000\/?$/)
  })

  // ─── 2. Guest (localStorage) wishlist ───────────────────────────────────

  test('3. guest: heart button on PDP toggles active state', async ({ page }) => {
    test.skip(!testProductId, 'Requires test product')

    await page.context().clearCookies()
    await page.goto(`/product/${testProductId}`)
    await page.waitForLoadState('networkidle')

    const wishBtn = page.locator(`button[aria-label="Add ${PRODUCT_NAME} to wishlist"]`)
    await expect(wishBtn).toBeVisible({ timeout: 8000 })
    await wishBtn.click()

    await expect(page.locator(`button[aria-label="Remove ${PRODUCT_NAME} from wishlist"]`)).toBeVisible()
  })

  test('4. guest: wishlisted product persists to /wishlist via localStorage', async ({ page }) => {
    test.skip(!testProductId, 'Requires test product')

    await page.context().clearCookies()
    await page.goto(`/product/${testProductId}`)
    await page.waitForLoadState('networkidle')
    await page.locator(`button[aria-label="Add ${PRODUCT_NAME} to wishlist"]`).click()
    await expect(page.locator(`button[aria-label="Remove ${PRODUCT_NAME} from wishlist"]`)).toBeVisible()

    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1', { hasText: 'Wishlist' })).toBeVisible()
    await expect(page.locator('.wishlist-grid').getByText(PRODUCT_NAME)).toBeVisible()
  })

  test('5. guest: remove from wishlist drops it from /wishlist', async ({ page }) => {
    test.skip(!testProductId, 'Requires test product')

    await page.context().clearCookies()
    await page.goto(`/product/${testProductId}`)
    await page.waitForLoadState('networkidle')
    await page.locator(`button[aria-label="Add ${PRODUCT_NAME} to wishlist"]`).click()

    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.wishlist-grid').getByText(PRODUCT_NAME)).toBeVisible()

    await page.locator(`button[aria-label="Remove ${PRODUCT_NAME} from wishlist"]`).first().click()
    await expect(page.locator('.wishlist-empty')).toBeVisible({ timeout: 6000 })
  })

  // ─── 3. Logged-in (server-backed) wishlist ──────────────────────────────

  test('6. logged-in: toggling wishlist persists via /api/wishlist', async ({ page }) => {
    test.skip(!testProductId, 'Requires test product')

    await loginAsUser(page)
    await page.request.delete(`/api/wishlist?productId=${testProductId}`)

    await page.goto(`/product/${testProductId}`)
    await page.waitForLoadState('networkidle')
    // WishlistProvider fires the persisting POST without awaiting it
    // client-side, so wait on the request itself rather than racing it.
    const [postRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/wishlist') && r.request().method() === 'POST'),
      page.locator(`button[aria-label="Add ${PRODUCT_NAME} to wishlist"]`).click(),
    ])
    expect(postRes.ok()).toBe(true)
    await expect(page.locator(`button[aria-label="Remove ${PRODUCT_NAME} from wishlist"]`)).toBeVisible()

    // Server-side confirmation, independent of client state
    const res = await page.request.get('/api/wishlist')
    const items = (await res.json()) as { productId: string }[]
    expect(items.some((i) => i.productId === testProductId)).toBe(true)

    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.wishlist-grid').getByText(PRODUCT_NAME)).toBeVisible()

    // Cleanup for the next test
    await page.request.delete(`/api/wishlist?productId=${testProductId}`)
  })

  // ─── 4. Public /wishlist ─────────────────────────────────────────────────

  test('7. /wishlist is public — no login redirect, shows empty state for a fresh guest', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/wishlist')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/wishlist$/)
    await expect(page.locator('.wishlist-empty')).toBeVisible()
  })

  test('8. GET /api/wishlist requires auth (401) — only the page is public, not the API', async ({ page }) => {
    await page.context().clearCookies()
    const res = await page.request.get('/api/wishlist')
    expect(res.status()).toBe(401)
  })
})
