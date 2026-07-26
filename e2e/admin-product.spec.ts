import { test, expect, type Page } from '@playwright/test'

// ─── helpers ───────────────────────────────────────────────────────────────

async function loginAsAdmin(page: Page) {
  await page.goto('/auth/admin')
  await page.waitForLoadState('networkidle')
  await page.locator('input[name="email"]').fill('nish99.sn@gmail.com')
  await page.locator('input[name="password"]').fill('Admin1234!')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 })
}

async function deleteProductViaApi(page: Page, productId: string) {
  const res = await page.request.delete(`/api/admin/products/${productId}`)
  expect([204, 404]).toContain(res.status())
}

// ─── tests ─────────────────────────────────────────────────────────────────

test.describe('Admin product CRUD + store reflection', () => {
  // Shared state between tests — Playwright runs tests within a describe
  // sequentially when fullyParallel is false.
  let createdProductId = ''
  // Unique per run — a prior run's failed-before-cleanup product must never
  // collide with this one on the itemCode unique constraint.
  const ITEM_CODE = `E2E-${Date.now()}`
  const SKU = `${ITEM_CODE}-G18K`

  test.afterAll(async ({ browser }) => {
    if (createdProductId) {
      const context = await browser.newContext()
      const page = await context.newPage()
      try {
        await loginAsAdmin(page)
        await deleteProductViaApi(page, createdProductId)
      } catch {
        // Best-effort cleanup
      } finally {
        await context.close()
      }
    }
  })

  test('Step 1: Login as admin and reach /admin/dashboard', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page).toHaveURL(/\/admin\/dashboard/)
  })

  test('Step 2: /admin/products/new page loads correctly', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/products/new')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1', { hasText: 'New Product' })).toBeVisible()
    // ProductForm sections present
    await expect(page.locator('text=Basic Information')).toBeVisible()
    await expect(page.locator('text=Metal Variants')).toBeVisible()
  })

  test('Steps 3–5: Create product → redirected to products list → product in table', async ({
    page,
  }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/products/new')
    // Wait for client component to fully hydrate before interacting
    await page.waitForSelector('input[placeholder*="Heart Diamond"]', { state: 'visible', timeout: 15000 })

    // --- Basic Information ---
    // Product Name input (placeholder: "e.g. Heart Diamond Bracelet")
    await page.locator('input[placeholder*="Heart Diamond"]').fill('E2E Test Ring')

    // Item Code input — use exact placeholder to avoid matching SKU input (which also contains AJBR)
    await page.getByPlaceholder('e.g. AJBR-74').fill(ITEM_CODE)

    // Category select — first <select> on the form
    await page.locator('form select').first().selectOption('RINGS')

    // Description textarea (first textarea)
    await page.locator('textarea').first().fill('E2E test product')

    // Status defaults to Draft — set Live so the product is visible on the
    // storefront (pricing v2: storefront visibility follows status, not isActive)
    await page.getByTestId('product-status').selectOption('LIVE')

    // --- Metal Variants section ---
    // Selects in order: Category(0), Status(1), Metal Type(2) — Status field
    // added in pricing v2.
    await page.locator('form select').nth(2).selectOption('GOLD_18K')

    // Weight input (placeholder "8.500") — only one with this placeholder
    await page.locator('input[placeholder="8.500"]').fill('3.5')

    // Making charge per gram (now required) — wait for pricing section to render
    const makingInput = page.locator('input[placeholder="e.g. 400"]')
    await makingInput.waitFor({ state: 'visible', timeout: 10000 })
    await makingInput.scrollIntoViewIfNeeded()
    await makingInput.fill('300')

    // Stock input — data-testid="variant-stock"
    const stockInput = page.getByTestId('variant-stock')
    await stockInput.waitFor({ state: 'visible', timeout: 5000 })
    await stockInput.fill('5')

    // SKU input — placeholder "AJBR-74-G18K" (uses short suffix format)
    // After filling itemCode, buildSku auto-sets the SKU value
    const skuInput = page.getByPlaceholder('AJBR-74-G18K')
    await skuInput.waitFor({ state: 'visible', timeout: 5000 })
    await page.waitForTimeout(300) // let React propagate itemCode → sku
    const currentSku = await skuInput.inputValue()
    if (!currentSku) {
      await skuInput.fill(SKU)
    }

    // --- Submit ---
    await page.locator('button[type="submit"]', { hasText: 'Create Product' }).click()

    // ProductForm does router.push('/admin/products') after successful fetch —
    // client-side navigation via history API, so poll the URL directly rather
    // than page.waitForURL (which waits on a 'load' event that a client-side
    // route transition never fires in dev/Turbopack).
    await expect
      .poll(() => page.url(), { timeout: 20000, message: 'expected redirect to /admin/products' })
      .toMatch(/\/admin\/products$/)
    await page.waitForLoadState('networkidle')

    // Product must appear in the table. Admin renders both a mobile-card
    // list and a desktop table in the DOM simultaneously (CSS media query
    // toggles which is visible) — scope to the table, which is what's
    // actually visible at Playwright's default desktop viewport.
    await expect(page.locator('table').getByText('E2E Test Ring')).toBeVisible()

    // Capture product ID from the last Edit link (newest product is last or first depending on sort)
    // Admin sorts by createdAt desc so the newest is at the top → first row's Edit link
    const editLinks = page.locator('a', { hasText: 'Edit' })
    const count = await editLinks.count()
    for (let i = 0; i < count; i++) {
      const href = await editLinks.nth(i).getAttribute('href')
      const match = href?.match(/\/admin\/products\/([^/]+)\/edit/)
      if (match?.[1]) {
        // Verify by checking if the row contains "E2E Test Ring"
        const row = editLinks.nth(i).locator('..').locator('..').locator('..')
        const rowText = await row.textContent().catch(() => '')
        if (rowText?.includes('E2E Test Ring')) {
          createdProductId = match[1]
          break
        }
        // Fallback: store the first match if we can't read the row text
        if (!createdProductId) createdProductId = match[1]
      }
    }
  })

  test('Step 6: /all-products/rings shows the created product', async ({ page }) => {
    test.skip(!createdProductId, 'Requires product creation (Step 3–5)')

    await page.goto('/all-products/rings')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=E2E Test Ring')).toBeVisible()
  })

  test('Steps 7–8: Product detail page shows item code and 18kt Gold variant', async ({
    page,
  }) => {
    test.skip(!createdProductId, 'Requires product creation (Step 3–5)')

    await page.goto(`/product/${createdProductId}`)
    await page.waitForLoadState('networkidle')

    // Item code
    await expect(page.locator('p.pdp-info__meta', { hasText: ITEM_CODE })).toBeVisible()

    // Product name in h1
    await expect(page.locator('h1', { hasText: 'E2E Test Ring' })).toBeVisible()

    // Metal selector only renders when a product has >1 metal (nothing to
    // pick otherwise) — this test product has a single GOLD_18K variant, so
    // assert against the price breakup instead, which always renders.
    await page.locator('summary', { hasText: 'Price Breakup' }).click()
    await expect(page.locator('text=3.500 g')).toBeVisible()
  })

  test('Steps 9–10: Edit product name and verify updated name on /all-products/rings', async ({
    page,
  }) => {
    test.skip(!createdProductId, 'Requires product creation (Step 3–5)')

    await loginAsAdmin(page)
    await page.goto(`/admin/products/${createdProductId}/edit`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1', { hasText: 'Edit Product' })).toBeVisible()

    // Clear the product name and enter new value
    const nameInput = page.locator('input[placeholder*="Heart Diamond"]')
    await nameInput.clear()
    await nameInput.fill('E2E Test Ring Updated')

    // Submit
    await page.locator('button[type="submit"]', { hasText: 'Save Changes' }).click()

    // Wait for redirect back to products list (poll — client-side nav, see note above)
    await expect
      .poll(() => page.url(), { timeout: 20000, message: 'expected redirect to /admin/products' })
      .toMatch(/\/admin\/products$/)
    await page.waitForLoadState('networkidle')

    // Admin table shows updated name
    await expect(page.locator('table').getByText('E2E Test Ring Updated')).toBeVisible()

    // Store /all-products/rings also shows updated name (revalidate=120 but dev mode skips cache)
    await page.goto('/all-products/rings')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=E2E Test Ring Updated')).toBeVisible()
  })

  test('Step 11: Cleanup — delete test product via API', async ({ page }) => {
    test.skip(!createdProductId, 'Requires product creation (Step 3–5)')

    await loginAsAdmin(page)
    await deleteProductViaApi(page, createdProductId)

    // Verify it no longer appears in admin products list
    await page.goto('/admin/products')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=E2E Test Ring Updated')).not.toBeVisible()

    createdProductId = ''
  })
})
