import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

/**
 * API-level e2e for the pricing-v2 / mock-gateway / promo / review /
 * cancellation surface added this session. Uses an authenticated browser
 * page (cookies attached) to drive the real Next.js API routes via
 * page.evaluate(fetch), matching the pattern in scripts/_order-lifecycle-test.mjs.
 * Direct Prisma access is used only for setup/assertions the API doesn't expose.
 *
 * Requires: PAYMENT_GATEWAY=mock, SHIPPING_MOCK=true (see .env.local.example).
 */

const prisma = new PrismaClient()

const CUSTOMER = { email: 'nish99.sn@gmail.com', password: 'Admin1234!' }

async function loginAsCustomer(page: Page) {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input[name="email"]').first().fill(CUSTOMER.email)
  await page.locator('input[name="password"]').first().fill(CUSTOMER.password)
  await page.locator('button[type="submit"]', { hasText: 'Sign In' }).click()
  await page.waitForURL(/^http:\/\/localhost:3000\/?$/, { timeout: 15000 })
}

async function loginAsAdmin(page: Page) {
  await page.goto('/auth/admin')
  await page.waitForLoadState('networkidle')
  await page.locator('input[name="email"]').fill(CUSTOMER.email)
  await page.locator('input[name="password"]').fill(CUSTOMER.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 })
}

/** Authenticated fetch via the browser's own cookies (page.request shares them). */
async function api(page: Page, path: string, init?: Parameters<Page['request']['fetch']>[1]) {
  const res = await page.request.fetch(path, init)
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON response */
  }
  return { status: res.status(), body: body as Record<string, unknown> }
}

async function getLiveVariant() {
  const variant = await prisma.productVariant.findFirst({
    where: { product: { isActive: true, status: 'LIVE' } },
    include: { product: true },
  })
  if (!variant) throw new Error('No LIVE product variant in DB — run prisma/seed.ts first')
  return variant
}

async function clearCart(userId: string) {
  await prisma.cartItem.deleteMany({ where: { userId } })
}

async function addToCart(page: Page, variantId: string, withExchange = false) {
  const res = await api(page, '/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ variantId, quantity: 1, withExchange }),
  })
  expect(res.status).toBe(201)
}

const ADDRESS = {
  contactName: 'E2E Buyer',
  contactPhone: '9876543210',
  addressLine1: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
}

async function checkout(page: Page, extra: Record<string, unknown> = {}) {
  return api(page, '/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ ...ADDRESS, ...extra }),
  })
}

async function cleanupOrder(orderId: string) {
  await prisma.promoRedemption.deleteMany({ where: { orderId } })
  await prisma.orderRefund.deleteMany({ where: { orderId } })
  await prisma.orderNote.deleteMany({ where: { orderId } })
  await prisma.orderEvent.deleteMany({ where: { orderId } })
  await prisma.shipment.deleteMany({ where: { orderId } })
  await prisma.orderItem.deleteMany({ where: { orderId } })
  await prisma.payment.deleteMany({ where: { orderId } })
  await prisma.order.delete({ where: { id: orderId } }).catch((err) => {
    // Surface real failures instead of silently leaving orphaned test data —
    // only a legitimately-already-deleted order (P2025) should be swallowed.
    if (err?.code !== 'P2025') throw err
  })
}

test.describe.configure({ mode: 'serial' })

// ─── Payment lifecycle (mock gateway) ───────────────────────────────────────

test.describe('Mock payment gateway — full lifecycle', () => {
  let userId: string

  test.beforeAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: CUSTOMER.email } })
    if (!user) throw new Error('Seed user missing')
    userId = user.id
  })

  test('checkout creates a PAYMENT_PENDING order with a mock gateway intent', async ({ page }) => {
    await loginAsCustomer(page)
    await clearCart(userId)
    const variant = await getLiveVariant()
    await addToCart(page, variant.id)

    const res = await checkout(page)
    expect(res.status).toBe(200)
    expect(res.body.gateway).toBe('mock')
    expect(res.body.orderId).toBeTruthy()
    expect(res.body.clientParams).toMatchObject({ mock: true })

    const order = await prisma.order.findUnique({ where: { id: res.body.orderId as string } })
    expect(order?.status).toBe('PAYMENT_PENDING')

    await cleanupOrder(res.body.orderId as string)
  })

  test('simulated success → payment.captured webhook → PAYMENT_CONFIRMED, no deposit', async ({ page }) => {
    await loginAsCustomer(page)
    await clearCart(userId)
    const variant = await getLiveVariant()
    await addToCart(page, variant.id)

    const checkoutRes = await checkout(page)
    expect(checkoutRes.status).toBe(200)
    const orderId = checkoutRes.body.orderId as string
    const gatewayOrderId = (checkoutRes.body.clientParams as { gatewayOrderId: string }).gatewayOrderId

    const payRes = await api(page, '/api/mock-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ gatewayOrderId, outcome: 'success' }),
    })
    expect(payRes.status).toBe(200)
    expect(payRes.body.gatewayPaymentId).toBeTruthy()

    // webhook is posted server-side inside /api/mock-pay before responding
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } })
    expect(order?.status).toBe('PAYMENT_CONFIRMED')
    expect(order?.payment?.status).toBe('CAPTURED')
    expect(Number(order?.depositAmount)).toBe(0)
    expect(Number(order?.grandTotal)).toBe(Number(order?.totalAmount))

    await cleanupOrder(orderId)
  })

  test('simulated failure → payment.failed webhook → order stays unpaid', async ({ page }) => {
    await loginAsCustomer(page)
    await clearCart(userId)
    const variant = await getLiveVariant()
    await addToCart(page, variant.id)

    const checkoutRes = await checkout(page)
    const orderId = checkoutRes.body.orderId as string
    const gatewayOrderId = (checkoutRes.body.clientParams as { gatewayOrderId: string }).gatewayOrderId

    const payRes = await api(page, '/api/mock-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ gatewayOrderId, outcome: 'fail' }),
    })
    expect(payRes.status).toBe(200)
    expect(payRes.body.failed).toBe(true)

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } })
    expect(order?.status).toBe('PAYMENT_PENDING')
    expect(order?.payment?.status).toBe('FAILED')

    await cleanupOrder(orderId)
  })

  test('retry-payment reuses the same gateway order id and succeeds', async ({ page }) => {
    await loginAsCustomer(page)
    await clearCart(userId)
    const variant = await getLiveVariant()
    await addToCart(page, variant.id)

    const checkoutRes = await checkout(page)
    const orderId = checkoutRes.body.orderId as string
    const originalGatewayOrderId = (checkoutRes.body.clientParams as { gatewayOrderId: string }).gatewayOrderId

    const retryRes = await api(page, `/api/orders/${orderId}/retry-payment`, { method: 'POST' })
    expect(retryRes.status).toBe(200)
    const retryGatewayOrderId = (retryRes.body.clientParams as { gatewayOrderId: string }).gatewayOrderId
    expect(retryGatewayOrderId).toBe(originalGatewayOrderId)

    const payRes = await api(page, '/api/mock-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ gatewayOrderId: retryGatewayOrderId, outcome: 'success' }),
    })
    expect(payRes.status).toBe(200)

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    expect(order?.status).toBe('PAYMENT_CONFIRMED')

    await cleanupOrder(orderId)
  })

  test('mock-pay endpoint 404s when PAYMENT_GATEWAY is not mock', async ({ page }) => {
    // This assumes .env.local has PAYMENT_GATEWAY=mock; if the suite runs
    // against a razorpay-configured env this route is correctly disabled.
    test.skip(process.env.PAYMENT_GATEWAY !== 'razorpay', 'Only meaningful when gateway is razorpay')
    await loginAsCustomer(page)
    const res = await api(page, '/api/mock-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ gatewayOrderId: 'x', outcome: 'success' }),
    })
    expect(res.status).toBe(404)
  })
})

// ─── Order cancellation + auto-refund ───────────────────────────────────────

test.describe('Customer cancellation', () => {
  let userId: string

  test.beforeAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: CUSTOMER.email } })
    userId = user!.id
  })

  test('cancel a PAYMENT_PENDING order — no refund needed', async ({ page }) => {
    await loginAsCustomer(page)
    await clearCart(userId)
    const variant = await getLiveVariant()
    await addToCart(page, variant.id)
    const checkoutRes = await checkout(page)
    const orderId = checkoutRes.body.orderId as string

    const cancelRes = await api(page, `/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ reason: 'Changed my mind' }),
    })
    expect(cancelRes.status).toBe(200)
    expect(cancelRes.body.refundInitiated).toBeFalsy()

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    expect(order?.status).toBe('CANCELLED')

    await cleanupOrder(orderId)
  })

  test('cancel a paid order → automatic full refund via mock gateway', async ({ page }) => {
    await loginAsCustomer(page)
    await clearCart(userId)
    const variant = await getLiveVariant()
    await addToCart(page, variant.id)
    const checkoutRes = await checkout(page)
    const orderId = checkoutRes.body.orderId as string
    const gatewayOrderId = (checkoutRes.body.clientParams as { gatewayOrderId: string }).gatewayOrderId

    await api(page, '/api/mock-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ gatewayOrderId, outcome: 'success' }),
    })

    const cancelRes = await api(page, `/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ reason: 'Found a better piece' }),
    })
    expect(cancelRes.status).toBe(200)
    expect(cancelRes.body.refundInitiated).toBe(true)

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    expect(order?.status).toBe('CANCELLED')

    const refund = await prisma.orderRefund.findFirst({ where: { orderId } })
    expect(refund).toBeTruthy()
    expect(refund?.kind).toBe('FULL')
    expect(refund?.method).toBe('GATEWAY')

    await cleanupOrder(orderId)
  })

  test('cannot cancel a SHIPPED order', async ({ page }) => {
    await loginAsCustomer(page)
    await clearCart(userId)
    const variant = await getLiveVariant()
    await addToCart(page, variant.id)
    const checkoutRes = await checkout(page)
    const orderId = checkoutRes.body.orderId as string
    const gatewayOrderId = (checkoutRes.body.clientParams as { gatewayOrderId: string }).gatewayOrderId

    await api(page, '/api/mock-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ gatewayOrderId, outcome: 'success' }),
    })

    // Advance straight to SHIPPED via admin PATCH (auto-books via SHIPPING_MOCK)
    await loginAsAdmin(page)
    const shipRes = await api(page, `/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ status: 'PREPARING' }),
    })
    expect(shipRes.status).toBe(200)
    const shipRes2 = await api(page, `/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ status: 'SHIPPED' }),
    })
    expect(shipRes2.status).toBe(200)

    await loginAsCustomer(page)
    const cancelRes = await api(page, `/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ reason: 'Too late attempt' }),
    })
    expect(cancelRes.status).toBe(409)

    await cleanupOrder(orderId)
  })
})

// ─── Promo codes ─────────────────────────────────────────────────────────────

test.describe('Promo codes', () => {
  let userId: string
  const percentCode = `E2EPCT${Date.now()}`
  const flatCode = `E2EFLT${Date.now()}`

  test.beforeAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: CUSTOMER.email } })
    userId = user!.id
    await prisma.promoCode.create({
      data: { code: percentCode, kind: 'PERCENT', value: 10, maxDiscount: 2000, maxPerUser: 1 },
    })
    await prisma.promoCode.create({
      data: { code: flatCode, kind: 'FLAT', value: 500, minOrderValue: 100000, maxPerUser: 1 },
    })
  })

  test.afterAll(async () => {
    await prisma.promoRedemption.deleteMany({ where: { promoCode: { code: { in: [percentCode, flatCode] } } } })
    await prisma.promoCode.deleteMany({ where: { code: { in: [percentCode, flatCode] } } })
  })

  test('validate: unknown code rejected', async ({ page }) => {
    await loginAsCustomer(page)
    const res = await api(page, '/api/promo/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ code: 'DOES-NOT-EXIST', cartTotal: 50000 }),
    })
    expect(res.status).toBe(422)
  })

  test('validate: percent code capped at maxDiscount', async ({ page }) => {
    await loginAsCustomer(page)
    // cartTotal 50000 × 10% = 5000, capped at maxDiscount 2000
    const res = await api(page, '/api/promo/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ code: percentCode, cartTotal: 50000 }),
    })
    expect(res.status).toBe(200)
    expect(res.body.discount).toBe(2000)
  })

  test('validate: flat code below minOrderValue rejected', async ({ page }) => {
    await loginAsCustomer(page)
    const res = await api(page, '/api/promo/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ code: flatCode, cartTotal: 5000 }),
    })
    expect(res.status).toBe(422)
  })

  test('checkout with a valid promo reduces grandTotal and ledgers a redemption', async ({ page }) => {
    await loginAsCustomer(page)
    await clearCart(userId)
    const variant = await getLiveVariant()
    await addToCart(page, variant.id)

    const cartRes = await api(page, '/api/cart')
    const goodsTotal = (cartRes.body as unknown as { unitPrice: number }[]).reduce(
      (s, i) => s + i.unitPrice,
      0,
    )

    const checkoutRes = await checkout(page, { promoCode: percentCode })
    expect(checkoutRes.status).toBe(200)
    const orderId = checkoutRes.body.orderId as string

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    const expectedDiscount = Math.min(Math.round(goodsTotal * 0.1), 2000)
    expect(Number(order?.discountAmount)).toBe(expectedDiscount)
    expect(Number(order?.grandTotal)).toBe(goodsTotal - expectedDiscount)

    const redemption = await prisma.promoRedemption.findFirst({ where: { orderId } })
    expect(redemption).toBeTruthy()

    await cleanupOrder(orderId)
  })

  test('promo code cannot be reused beyond maxPerUser after order completes', async ({ page }) => {
    await loginAsCustomer(page)
    await clearCart(userId)
    const variant = await getLiveVariant()
    await addToCart(page, variant.id)

    // First use — pay it so the redemption isn't released by expiry logic
    const first = await checkout(page, { promoCode: percentCode })
    const firstOrderId = first.body.orderId as string
    const gatewayOrderId = (first.body.clientParams as { gatewayOrderId: string }).gatewayOrderId
    await api(page, '/api/mock-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ gatewayOrderId, outcome: 'success' }),
    })

    // Second attempt with the same maxPerUser=1 code
    await clearCart(userId)
    await addToCart(page, variant.id)
    const validateRes = await api(page, '/api/promo/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ code: percentCode, cartTotal: 50000 }),
    })
    expect(validateRes.status).toBe(422)

    await cleanupOrder(firstOrderId)
  })
})

// ─── Reviews ──────────────────────────────────────────────────────────────────

test.describe('Product reviews', () => {
  let userId: string
  let productId: string

  test.beforeAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: CUSTOMER.email } })
    userId = user!.id
    const variant = await getLiveVariant()
    productId = variant.productId
    // Clean any leftover review/order from a prior failed run or manual
    // testing session — this suite asserts the *absence* of a delivered
    // order, so stray fixture data would silently flip the expected result.
    await prisma.review.deleteMany({ where: { userId, productId } })
    const staleOrders = await prisma.order.findMany({
      where: { userId, items: { some: { variant: { productId } } } },
      select: { id: true },
    })
    for (const o of staleOrders) await cleanupOrder(o.id)
  })

  test.afterEach(async () => {
    await prisma.review.deleteMany({ where: { userId, productId } })
  })

  test('unauthenticated review submission is rejected', async ({ page }) => {
    await page.context().clearCookies()
    const res = await api(page, `/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ rating: 5, body: 'Should be blocked, no session' }),
    })
    expect(res.status).toBe(401)
  })

  test('review without a delivered order is unverified and pending moderation', async ({ page }) => {
    await loginAsCustomer(page)
    const res = await api(page, `/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ rating: 4, body: 'Nice piece, no purchase on record for this test' }),
    })
    expect(res.status).toBe(201)
    expect(res.body.verified).toBe(false)
    expect(res.body.pendingModeration).toBe(true)

    // Not visible on the public GET until approved
    const listRes = await api(page, `/api/products/${productId}/reviews`)
    expect((listRes.body.reviews as unknown[]).length).toBe(0)
  })

  test('duplicate review on the same product is rejected', async ({ page }) => {
    await loginAsCustomer(page)
    await api(page, `/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ rating: 5, body: 'First review for duplicate test' }),
    })
    const dupRes = await api(page, `/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ rating: 3, body: 'Second attempt should be rejected' }),
    })
    expect(dupRes.status).toBe(409)
  })

  test('review from a DELIVERED order is verified; admin approval makes it public', async ({ page }) => {
    await loginAsCustomer(page)
    await clearCart(userId)
    const variant = await getLiveVariant()
    await addToCart(page, variant.id)
    const checkoutRes = await checkout(page)
    const orderId = checkoutRes.body.orderId as string
    const gatewayOrderId = (checkoutRes.body.clientParams as { gatewayOrderId: string }).gatewayOrderId
    await api(page, '/api/mock-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ gatewayOrderId, outcome: 'success' }),
    })

    await loginAsAdmin(page)
    await api(page, `/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ status: 'PREPARING' }),
    })
    await api(page, `/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ status: 'SHIPPED' }),
    })
    await api(page, `/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ status: 'DELIVERED' }),
    })

    await loginAsCustomer(page)
    const reviewRes = await api(page, `/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ rating: 5, title: 'Love it', body: 'Verified-purchase review from e2e' }),
    })
    expect(reviewRes.status).toBe(201)
    expect(reviewRes.body.verified).toBe(true)

    const reviewRow = await prisma.review.findFirst({ where: { userId, productId } })
    expect(reviewRow?.status).toBe('PENDING')

    await loginAsAdmin(page)
    const approveRes = await api(page, `/api/admin/reviews/${reviewRow!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ status: 'APPROVED' }),
    })
    expect(approveRes.status).toBe(200)

    const listRes = await api(page, `/api/products/${productId}/reviews`)
    const reviews = listRes.body.reviews as { verified: boolean; id: string }[]
    expect(reviews.some((r) => r.id === reviewRow!.id && r.verified)).toBe(true)

    await cleanupOrder(orderId)
  })
})

// ─── Authorization ───────────────────────────────────────────────────────────

test.describe('Authorization boundaries', () => {
  test('admin API routes reject unauthenticated requests', async ({ page }) => {
    await page.context().clearCookies()
    // requireAdmin() (lib/auth.ts) redirects rather than returning a JSON
    // error — assert the redirect itself, not the followed destination.
    const endpoints = ['/api/admin/products', '/api/admin/orders', '/api/admin/promos', '/api/admin/reviews']
    for (const ep of endpoints) {
      const res = await page.request.fetch(ep, { maxRedirects: 0 })
      expect(res.status()).toBe(307)
      expect(res.headers()['location']).toContain('/auth/admin')
    }
  })

  test('admin API routes reject a logged-in non-admin customer', async ({ page }) => {
    // nish99.sn@gmail.com is in ADMIN_EMAILS for this repo — use a fresh
    // non-admin signup instead to test the boundary genuinely.
    const email = `e2e.nonadmin.${Date.now()}@vairistest.com`
    await page.goto('/auth/login?mode=signup')
    await page.waitForLoadState('networkidle')
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill('NonAdmin123!')
    await page.getByRole('button', { name: 'Create Account' }).click()
    await page.waitForURL(/mode=confirm|msg=/, { timeout: 10000 }).catch(() => {})

    // Local dev auto-confirms (enable_confirmations=false) — sign in directly
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')
    await page.locator('input[name="email"]').first().fill(email)
    await page.locator('input[name="password"]').first().fill('NonAdmin123!')
    await page.locator('button[type="submit"]', { hasText: 'Sign In' }).click()
    await page.waitForURL(/^http:\/\/localhost:3000\/?$/, { timeout: 15000 }).catch(() => {})

    // requireAdmin() redirects a non-admin session to "/" — assert the
    // redirect itself rather than the followed (200) destination.
    const res = await page.request.fetch('/api/admin/products', { maxRedirects: 0 })
    expect(res.status()).toBe(307)
    expect(res.headers()['location']).toMatch(/\/$/)

    await prisma.user.deleteMany({ where: { email } })
  })

  test('order cancel/return endpoints reject a different customer', async ({ page, browser }) => {
    await loginAsCustomer(page)
    const user = await prisma.user.findUnique({ where: { email: CUSTOMER.email } })
    await clearCart(user!.id)
    const variant = await getLiveVariant()
    await addToCart(page, variant.id)
    const checkoutRes = await checkout(page)
    const orderId = checkoutRes.body.orderId as string

    // Different browser context = different (unauthenticated) session.
    // requireUser() (lib/auth.ts) redirects to /auth/login rather than
    // returning JSON — same established pattern as retry-payment and
    // return-request on this route family — so assert the redirect itself.
    const otherContext = await browser.newContext()
    const otherPage = await otherContext.newPage()
    const res = await otherPage.request.fetch(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ reason: 'not my order' }),
      maxRedirects: 0,
    })
    expect(res.status()).toBe(307)
    expect(res.headers()['location']).toContain('/auth/login')
    await otherContext.close()

    await cleanupOrder(orderId)
  })
})

// ─── Rate limiting ────────────────────────────────────────────────────────────

test.describe('Rate limiting', () => {
  test('search endpoint 429s after repeated rapid requests', async ({ page }) => {
    await page.goto('/')
    let sawLimit = false
    for (let i = 0; i < 70; i++) {
      const res = await api(page, `/api/search?q=ring${i}`)
      if (res.status === 429) {
        sawLimit = true
        break
      }
    }
    expect(sawLimit).toBe(true)
  })

  test('contact endpoint 429s after repeated rapid submissions', async ({ page }) => {
    await page.goto('/')
    let sawLimit = false
    for (let i = 0; i < 10; i++) {
      const res = await api(page, '/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          name: 'Rate Limit Test',
          email: 'ratelimit@example.com',
          message: `Message number ${i} for rate limit probing`,
        }),
      })
      if (res.status === 429) {
        sawLimit = true
        break
      }
    }
    expect(sawLimit).toBe(true)
    await prisma.contactRequest.deleteMany({ where: { email: 'ratelimit@example.com' } })
  })
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
