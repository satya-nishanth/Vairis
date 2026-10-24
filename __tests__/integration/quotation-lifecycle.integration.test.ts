// Load .env.local (DATABASE_URL, INTERNAL_API_KEY, DISCORD_*), as the very first statement in
// the file — before any `import` below (notably '@/lib/prisma', whose PrismaClient is
// constructed eagerly at module-load time) can read process.env. Using require() here (not
// `import`) is deliberate: it keeps this call textually and structurally first regardless of any
// jest.mock()/import hoisting the transform applies.
// NOTE: @next/env's loadEnvConfig() deliberately skips .env.local when NODE_ENV === 'test' (it
// treats "test" as its own environment tier, same as Next.js does for its own test runs) — which
// is exactly the NODE_ENV Jest sets. So this loads .env.local directly with dotenv instead of
// going through @next/env.
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') })

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as postPublicQuotation } from '@/app/api/quotations/route'
import { POST as postAdminQuotation } from '@/app/api/admin/quotations/route'
import { PATCH as patchAdminQuotation } from '@/app/api/admin/quotations/[id]/route'
import { POST as postAdminOrder } from '@/app/api/admin/orders/route'
import { GET as getInternalQuotations } from '@/app/api/internal/quotations/route'
import { PATCH as patchInternalQuotation } from '@/app/api/internal/quotations/[id]/route'

// Real integration test — everything here is real EXCEPT the Discord REST calls. This is the
// final verification pass for the quotation pipeline (23-task plan, see
// docs/superpowers/plans/2026-08-23-quotation-pipeline.md). Every route below already has a
// mocked-Prisma unit test and passed review; those structurally cannot verify:
//   - that the raw SQL `SELECT ... FOR UPDATE` dedup query in app/api/quotations/route.ts is
//     valid against a real Postgres schema (a mocked $queryRaw never touches a real DB),
//   - that the QUOTATION_TRANSITIONS.QUOTED idempotent-re-quote fix survives a real
//     read-then-write round trip,
//   - that the updateMany-based convert-to-order race guard in app/api/admin/orders/route.ts
//     really returns 0 affected rows (not just what a mock is told to return) once a quotation
//     is genuinely CONVERTED.
// So here: @/lib/prisma is the real client against the local dev Postgres this repo is already
// configured to use, and every route handler above is called directly (not proxied through an
// HTTP server) with that real client wired in. Only lib/quotations.ts's Discord REST calls
// (global.fetch to discord.com/api/v10/...) are mocked — Discord itself isn't infrastructure this
// feature is being verified against, and hitting it for real would require live bot credentials
// and would spam a real channel on every test run.
//
// Requires DATABASE_URL to be set (it's pulled from .env.local, matching how this repo's dev
// server itself connects to the local Supabase Postgres at 127.0.0.1:54322); skipped otherwise.
const describeIfConfigured = process.env.DATABASE_URL ? describe : describe.skip

if (!process.env.DATABASE_URL) {
  console.warn(
    '⚠️ Skipping quotation-lifecycle integration test — set DATABASE_URL (e.g. via .env.local, ' +
      'pointing at the local dev Postgres) to run it.',
  )
}

// Distinctive marker so every row this test creates is unambiguous to find and delete — no
// truncation, no touching anything else in the dev database.
const RUN_ID = Date.now().toString()
const TEST_EMAIL = `integration-test-${RUN_ID}@integration-test.local`
const TEST_SKU = `INTTEST-SKU-${RUN_ID}`
const TEST_MOBILE_1 = `9999${RUN_ID}`.slice(0, 15) // step 1 (public intake + dedup)

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }))

function jsonReq(url: string, method: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json', ...extraHeaders },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describeIfConfigured('Quotation pipeline — real-database integration', () => {
  // Fixture rows (a real User + Product + ProductVariant), created once and reused as the
  // order-conversion step's dependencies.
  let fixtureUserId: string
  let fixtureProductId: string
  let fixtureVariantId: string

  // Rows created by the scenario itself, tracked so cleanup can delete exactly these and nothing
  // else.
  let quotationStep1Id: string // public/WEBSITE, stays REQUESTED throughout (used for internal API step)
  let quotationStep2Id: string // MANUAL/CUSTOMISATION, quoted then converted to an order
  let createdOrderId: string | undefined

  beforeAll(async () => {
    // Discord REST is the only thing mocked. Anything that isn't a discord.com/api/v10 call
    // fails loudly instead of silently hitting the real network from a test.
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'
      if (!url.startsWith('https://discord.com/api/v10')) {
        throw new Error(`Unexpected real fetch() in integration test: ${method} ${url}`)
      }
      if (method === 'POST' && url.endsWith('/threads')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ id: `discord-thread-${Math.random().toString(36).slice(2)}` }),
          text: async () => '',
        } as Response
      }
      // messages POST, thread PATCH (archive) — content doesn't matter to the routes under test.
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' } as Response
    }) as unknown as typeof fetch

    const product = await prisma.product.create({
      data: {
        name: `[integration-test] Fixture Product ${RUN_ID}`,
        description: 'Fixture product created by quotation-lifecycle.integration.test.ts — safe to delete.',
        category: 'RINGS',
        images: [],
      },
    })
    fixtureProductId = product.id

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        metalType: 'GOLD_18K',
        weightGrams: 5.5,
        sku: TEST_SKU,
      },
    })
    fixtureVariantId = variant.id

    const user = await prisma.user.create({
      data: { name: 'Integration Test Customer', email: TEST_EMAIL },
    })
    fixtureUserId = user.id
  })

  afterAll(async () => {
    // Delete in FK-safe order: OrderItem (no cascade from Order) -> Order (cascades OrderEvent /
    // OrderNote) -> Quotation -> Product (cascades ProductVariant) -> User.
    if (createdOrderId) {
      await prisma.orderItem.deleteMany({ where: { orderId: createdOrderId } })
      await prisma.order.deleteMany({ where: { id: createdOrderId } })
    }
    await prisma.quotation.deleteMany({
      where: { id: { in: [quotationStep1Id, quotationStep2Id].filter(Boolean) } },
    })
    if (fixtureProductId) await prisma.product.deleteMany({ where: { id: fixtureProductId } })
    if (fixtureUserId) await prisma.user.deleteMany({ where: { id: fixtureUserId } })
  })

  // --- Step 1: public intake + dedup -----------------------------------------------------

  it('POST /api/quotations creates a REQUESTED/WEBSITE quotation, genuinely persisted', async () => {
    const res = await postPublicQuotation(
      jsonReq('http://localhost/api/quotations', 'POST', {
        customerName: 'Integration Test Customer',
        customerMobile: TEST_MOBILE_1,
        details: '[integration-test] first-time enquiry',
      }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    quotationStep1Id = body.id
    expect(body.status).toBe('REQUESTED')
    expect(body.customerMobile).toBe(TEST_MOBILE_1)
    expect(body.discordThreadId).toBeTruthy() // set by the (mocked-fetch) createQuoteThread call

    const dbRow = await prisma.quotation.findUnique({ where: { id: quotationStep1Id } })
    expect(dbRow).not.toBeNull()
    expect(dbRow?.source).toBe('WEBSITE')
    expect(dbRow?.orderType).toBe('VAIRIS')
    expect(dbRow?.status).toBe('REQUESTED')
    expect(dbRow?.customerMobile).toBe(TEST_MOBILE_1)
  })

  it('a second POST with the same mobile reuses the existing quotation instead of duplicating it', async () => {
    const res = await postPublicQuotation(
      jsonReq('http://localhost/api/quotations', 'POST', {
        customerName: 'Integration Test Customer (retry)',
        customerMobile: TEST_MOBILE_1,
      }),
    )
    // 200, not 201: proves the real `SELECT ... FOR UPDATE` dedup query against real Postgres
    // found the still-open row rather than creating a duplicate.
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(quotationStep1Id)

    const rows = await prisma.quotation.findMany({ where: { customerMobile: TEST_MOBILE_1 } })
    expect(rows).toHaveLength(1)
  })

  // --- Step 2: admin manual intake --------------------------------------------------------

  it('POST /api/admin/quotations creates a MANUAL/CUSTOMISATION quotation with no phone', async () => {
    const res = await postAdminQuotation(
      jsonReq('http://localhost/api/admin/quotations', 'POST', {
        orderType: 'CUSTOMISATION',
        details: '[integration-test] custom engagement ring — customer described in-store visit',
      }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    quotationStep2Id = body.id

    const dbRow = await prisma.quotation.findUnique({ where: { id: quotationStep2Id } })
    expect(dbRow).not.toBeNull()
    expect(dbRow?.source).toBe('MANUAL')
    expect(dbRow?.orderType).toBe('CUSTOMISATION')
    expect(dbRow?.customerMobile).toBeNull()
    expect(dbRow?.status).toBe('REQUESTED')
  })

  // --- Step 3: mark quoted, then re-quote (idempotency) -----------------------------------

  it('PATCH mark_quoted flips status to QUOTED and sets quotedAt, genuinely persisted', async () => {
    const res = await patchAdminQuotation(
      jsonReq(`http://localhost/api/admin/quotations/${quotationStep2Id}`, 'PATCH', {
        action: 'mark_quoted',
        quotedAmount: 55000,
        quotedNotes: '[integration-test] initial quote',
      }),
      { params: Promise.resolve({ id: quotationStep2Id }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('QUOTED')
    expect(body.quotedAmount).toBe(55000)

    const dbRow = await prisma.quotation.findUnique({ where: { id: quotationStep2Id } })
    expect(dbRow?.status).toBe('QUOTED')
    expect(dbRow?.quotedAt).not.toBeNull()
    expect(dbRow?.quotedAmount).toBe(55000)
  })

  it('re-quoting an already-QUOTED quotation succeeds (not 409) and overwrites the amount for real', async () => {
    const res = await patchAdminQuotation(
      jsonReq(`http://localhost/api/admin/quotations/${quotationStep2Id}`, 'PATCH', {
        action: 'mark_quoted',
        quotedAmount: 62000,
        quotedNotes: '[integration-test] corrected quote after typo',
      }),
      { params: Promise.resolve({ id: quotationStep2Id }) },
    )
    // Proves QUOTATION_TRANSITIONS.QUOTED's self-transition against a real read-then-write —
    // not just a mocked findUnique/update pair that can't disagree with itself.
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.quotedAmount).toBe(62000)

    const dbRow = await prisma.quotation.findUnique({ where: { id: quotationStep2Id } })
    expect(dbRow?.status).toBe('QUOTED')
    expect(dbRow?.quotedAmount).toBe(62000)
    expect(dbRow?.quotedNotes).toBe('[integration-test] corrected quote after typo')
  })

  // --- Step 4: convert to order — the race guard, for real --------------------------------

  function orderPayload() {
    return {
      userId: fixtureUserId,
      contactName: 'Integration Test Customer',
      contactPhone: '9876543210',
      addressLine1: '1 Integration Test Lane',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      initialStatus: 'PAYMENT_CONFIRMED' as const,
      paymentNote: '[integration-test] paid via UPI',
      quotationId: quotationStep2Id,
      items: [{ variantId: fixtureVariantId, quantity: 1, unitPrice: 62000 }],
    }
  }

  it('POST /api/admin/orders converts the QUOTED quotation to CONVERTED with a real orderId', async () => {
    const res = await postAdminOrder(jsonReq('http://localhost/api/admin/orders', 'POST', orderPayload()))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.orderId).toBeTruthy()
    createdOrderId = body.orderId

    const dbQuotation = await prisma.quotation.findUnique({ where: { id: quotationStep2Id } })
    expect(dbQuotation?.status).toBe('CONVERTED')
    expect(dbQuotation?.orderId).toBe(createdOrderId)

    const dbOrder = await prisma.order.findUnique({ where: { id: createdOrderId } })
    expect(dbOrder).not.toBeNull()
    expect(dbOrder?.quotationId).toBe(quotationStep2Id)
  })

  it('converting the same (now-CONVERTED) quotation again returns 409 and creates no second order', async () => {
    const res = await postAdminOrder(jsonReq('http://localhost/api/admin/orders', 'POST', orderPayload()))
    // Proves the updateMany({ where: { id, status: 'QUOTED' } }) atomic guard holds against a
    // genuinely CONVERTED row in real Postgres — not a mock told to return count: 0.
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.orderId).toBeUndefined()

    const orders = await prisma.order.findMany({ where: { quotationId: quotationStep2Id } })
    expect(orders).toHaveLength(1)
    expect(orders[0].id).toBe(createdOrderId)

    const dbQuotation = await prisma.quotation.findUnique({ where: { id: quotationStep2Id } })
    expect(dbQuotation?.orderId).toBe(createdOrderId) // unchanged
  })

  // --- Step 5: internal API (bot-facing) round trip ---------------------------------------

  it('GET /api/internal/quotations returns the still-open quotation but not the CONVERTED one', async () => {
    const res = await getInternalQuotations(
      new NextRequest('http://localhost/api/internal/quotations', {
        headers: { authorization: `Bearer ${process.env.INTERNAL_API_KEY}` },
      }),
    )
    expect(res.status).toBe(200)
    const body: Array<{ id: string }> = await res.json()

    expect(body.some((q) => q.id === quotationStep1Id)).toBe(true)
    expect(body.some((q) => q.id === quotationStep2Id)).toBe(false) // CONVERTED — pruned by the open-status filter
  })

  it('PATCH /api/internal/quotations/[id] persists bookkeeping fields for real', async () => {
    const lastReminderAt = new Date().toISOString()
    const res = await patchInternalQuotation(
      jsonReq(`http://localhost/api/internal/quotations/${quotationStep1Id}`, 'PATCH', {
        lastReminderAt,
        reminderCount: 3,
      }, { authorization: `Bearer ${process.env.INTERNAL_API_KEY}` }),
      { params: Promise.resolve({ id: quotationStep1Id }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reminderCount).toBe(3)

    const dbRow = await prisma.quotation.findUnique({ where: { id: quotationStep1Id } })
    expect(dbRow?.reminderCount).toBe(3)
    expect(dbRow?.lastReminderAt?.toISOString()).toBe(lastReminderAt)
  })

  // --- Step 6: TRUE concurrency — the race the claim-before-create fix closes ------------
  //
  // Everything above exercises the route sequentially, one await at a time — including "convert
  // the same now-CONVERTED quotation again" in step 4, which is really "convert, THEN convert
  // again" and can never observe two transactions genuinely overlapping mid-flight. That's
  // exactly the gap: the original bug was that app/api/admin/orders/route.ts ran a fast unlocked
  // quotation.findUnique, THEN order.create() (inserting a row with the @unique
  // Order.quotationId), and only THEN the atomic updateMany guard. Under real simultaneous
  // requests both transactions' findUnique could see QUOTED before either committed, so both
  // proceeded to order.create() — the second insert would block on the unique index until the
  // first committed, then fail with a raw Prisma P2002 (uncaught -> 500), not the clean
  // ConvertConflictError -> 409 this test proves instead. The fix reorders the transaction so the
  // conditional updateMany (the atomic claim) runs FIRST, before order.create() ever executes.
  describe('convert-to-order race guard under real concurrency', () => {
    // Own throwaway quotation fixture — reuses the User/ProductVariant fixtures created in the
    // outer beforeAll, since this scenario only concerns the convert step, not intake.
    let concurrencyQuotationId: string
    let concurrencyOrderId: string | undefined

    beforeAll(async () => {
      const quotation = await prisma.quotation.create({
        data: {
          displayId: `Q-RACE-${RUN_ID}`,
          source: 'MANUAL',
          status: 'QUOTED',
          orderType: 'CUSTOMISATION',
          details: '[integration-test] concurrency race fixture — safe to delete',
          quotedAmount: 40000,
          quotedAt: new Date(),
        },
      })
      concurrencyQuotationId = quotation.id
    })

    afterAll(async () => {
      if (concurrencyOrderId) {
        await prisma.orderItem.deleteMany({ where: { orderId: concurrencyOrderId } })
        await prisma.order.deleteMany({ where: { id: concurrencyOrderId } })
      }
      await prisma.quotation.deleteMany({ where: { id: concurrencyQuotationId } })
    })

    function concurrencyOrderPayload() {
      return {
        userId: fixtureUserId,
        contactName: 'Integration Test Customer (race)',
        contactPhone: '9876543211',
        addressLine1: '2 Integration Test Lane',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        initialStatus: 'PAYMENT_CONFIRMED' as const,
        paymentNote: '[integration-test] race scenario',
        quotationId: concurrencyQuotationId,
        items: [{ variantId: fixtureVariantId, quantity: 1, unitPrice: 40000 }],
      }
    }

    it('exactly one of two truly concurrent converts succeeds (201); the other gets a clean 409, never a 500', async () => {
      // Fired via Promise.all — NOT sequential awaits — so both POST handlers' transactions are
      // genuinely in flight at once against the real Postgres connection pool.
      const [resA, resB] = await Promise.all([
        postAdminOrder(jsonReq('http://localhost/api/admin/orders', 'POST', concurrencyOrderPayload())),
        postAdminOrder(jsonReq('http://localhost/api/admin/orders', 'POST', concurrencyOrderPayload())),
      ])

      const statuses = [resA.status, resB.status].sort()
      expect(statuses).toEqual([201, 409])

      const winner = resA.status === 201 ? resA : resB
      const loser = resA.status === 201 ? resB : resA

      const winnerBody = await winner.json()
      expect(winnerBody.orderId).toBeTruthy()
      concurrencyOrderId = winnerBody.orderId

      const loserBody = await loser.json()
      expect(loserBody.orderId).toBeUndefined()

      // No duplicate/orphan order: exactly one Order row references this quotationId.
      const orders = await prisma.order.findMany({ where: { quotationId: concurrencyQuotationId } })
      expect(orders).toHaveLength(1)
      expect(orders[0].id).toBe(concurrencyOrderId)

      // Quotation ended up CONVERTED, linked to the winning order — not left mid-limbo.
      const dbQuotation = await prisma.quotation.findUnique({ where: { id: concurrencyQuotationId } })
      expect(dbQuotation?.status).toBe('CONVERTED')
      expect(dbQuotation?.orderId).toBe(concurrencyOrderId)
    })
  })
})
