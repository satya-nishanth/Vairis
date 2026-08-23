/**
 * Prod-like order + mock payment to test auto-created finance INFLOW.
 * Usage: node scripts/_test-auto-txn-order.mjs
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { chromium } from '@playwright/test'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const CUSTOMER = { email: 'nish99.sn@gmail.com', password: 'Admin1234!' }
const SKUS = ['AJLR-587', 'AJLR-598']

const prisma = new PrismaClient()

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const envVar = (name) => envFile.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim()
const GATEWAY = envVar('PAYMENT_GATEWAY') || 'razorpay'

const ADDRESS = {
  contactName: 'Test Auto Txn',
  contactPhone: '9876543210',
  addressLine1: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
}

async function main() {
  console.log('PAYMENT_GATEWAY (from .env.local):', GATEWAY)
  console.log('Base URL:', BASE)
  if (GATEWAY !== 'mock') {
    throw new Error('Set PAYMENT_GATEWAY=mock in .env.local for this test')
  }

  const variants = await prisma.productVariant.findMany({
    where: { product: { itemCode: { in: SKUS } } },
    include: { product: { select: { itemCode: true, name: true, status: true, isActive: true } } },
  })
  const bySku = Object.fromEntries(variants.map((v) => [v.product.itemCode, v]))
  for (const sku of SKUS) {
    const v = bySku[sku]
    if (!v) throw new Error(`Variant not found for ${sku}`)
    if (v.product.status !== 'LIVE' || !v.product.isActive) {
      console.warn(`Warning: ${sku} is not LIVE/active — checkout may fail`)
    }
    console.log(`Found ${sku}: ${v.product.name} (${v.id})`)
  }

  const user = await prisma.user.findUnique({ where: { email: CUSTOMER.email } })
  if (!user) throw new Error('Customer user missing')
  await prisma.cartItem.deleteMany({ where: { userId: user.id } })

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle' })
  await page.locator('input[name="email"]').first().fill(CUSTOMER.email)
  await page.locator('input[name="password"]').first().fill(CUSTOMER.password)
  await page.locator('button[type="submit"]', { hasText: 'Sign In' }).click()
  await page.waitForURL(/^http:\/\/localhost:3000\/?$/, { timeout: 20000 })
  console.log('Logged in as', CUSTOMER.email)

  const api = (path, init) =>
    page.evaluate(
      async ({ path, init }) => {
        const res = await fetch(path, init)
        let body = null
        try {
          body = await res.json()
        } catch {
          body = null
        }
        return { status: res.status, body }
      },
      { path, init },
    )

  for (const sku of SKUS) {
    const v = bySku[sku]
    const add = await api('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId: v.id, quantity: 1, withExchange: false }),
    })
    if (add.status !== 201) throw new Error(`Add to cart ${sku} failed: ${add.status} ${JSON.stringify(add.body)}`)
    console.log('Added to cart:', sku)
  }

  const checkout = await api('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADDRESS),
  })
  if (checkout.status !== 200) {
    throw new Error(`Checkout failed: ${checkout.status} ${JSON.stringify(checkout.body)}`)
  }
  const { orderId, clientParams } = checkout.body
  const gatewayOrderId = clientParams?.gatewayOrderId
  console.log('Checkout OK — order', orderId, '· gateway', gatewayOrderId)

  const pay = await api('/api/mock-pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gatewayOrderId, outcome: 'success' }),
  })
  if (pay.status !== 200) throw new Error(`Mock pay failed: ${pay.status} ${JSON.stringify(pay.body)}`)

  if (pay.body.signature && pay.body.gatewayPaymentId) {
    const verify = await api('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gatewayOrderId,
        gatewayPaymentId: pay.body.gatewayPaymentId,
        signature: pay.body.signature,
      }),
    })
    console.log('Payment verify:', verify.status, verify.body?.ok ? 'ok' : verify.body)
  }

  await browser.close()

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payment: true,
      children: { select: { id: true, status: true, grandTotal: true } },
    },
  })

  console.log('\n--- Order ---')
  console.log('Status:', order?.status)
  console.log('Grand total: ₹' + Number(order?.grandTotal).toLocaleString('en-IN'))
  console.log('Payment:', order?.payment?.status)
  console.log('Items:', order?.items.map((i) => i.productName).join(' · '))
  if (order?.children?.length) {
    console.log(
      'Split children:',
      order.children.map((c) => `${c.id.slice(-8)} ₹${Number(c.grandTotal).toLocaleString('en-IN')} ${c.status}`).join(', '),
    )
  }

  const tx = await prisma.financeTransaction.findFirst({
    where: {
      autoCreated: true,
      direction: 'INFLOW',
      orders: { some: { orderId } },
    },
    include: {
      orders: true,
      category: { select: { name: true } },
      paidThroughAccount: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log('\n--- Auto INFLOW (Finance → Transactions) ---')
  if (!tx) {
    console.log('NOT FOUND')
    process.exitCode = 1
  } else {
    console.log('Transaction:', tx.id.slice(-8), '(full id in DB)')
    console.log('Amount: ₹' + Number(tx.amount).toLocaleString('en-IN'))
    console.log('Category:', tx.category?.name)
    console.log('Bank:', tx.paidThroughAccount?.name)
    console.log('Auto-created:', tx.autoCreated, '· Review:', tx.reviewComplete ? 'Reviewed' : 'For review')
    console.log('Linked order(s):', tx.orders.map((o) => o.orderId.slice(-8)).join(', '))
  }

  console.log('\nAdmin: /admin/finance/transactions')
  console.log('Order: /admin/orders/' + orderId)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
