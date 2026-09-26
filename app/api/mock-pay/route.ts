import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { z } from 'zod'
import { getAppUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mockSign, postMockWebhook } from '@/lib/payments/mock'
import { isMockPayAllowed } from '@/lib/payments/mock-guard'

export const dynamic = 'force-dynamic'

/**
 * POST /api/mock-pay — the mock gateway's "payment processor".
 * Only active when PAYMENT_GATEWAY=mock and allowed by environment. Simulates the customer's action
 * on the /mock-pay modal:
 *
 *   success → self-posts a payment.captured webhook (HMAC-signed) and
 *             returns { gatewayPaymentId, signature } so the page can hit
 *             /api/payment/verify exactly like the Razorpay handler.
 *   fail    → self-posts payment.failed; page shows the failure state.
 *
 * Ownership-checked: only the order's owner can simulate its payment.
 */
const schema = z.object({
  gatewayOrderId: z.string().min(1),
  outcome: z.enum(['success', 'fail']),
})

export async function POST(req: NextRequest) {
  if (!isMockPayAllowed()) {
    return NextResponse.json({ error: 'Mock payments not enabled' }, { status: 404 })
  }

  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { gatewayOrderId, outcome } = parsed.data

  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: gatewayOrderId },
    include: { order: { select: { id: true, userId: true } } },
  })
  if (!payment || payment.order.userId !== user.id) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (outcome === 'fail') {
    await postMockWebhook({
      event: 'payment.failed',
      gatewayOrderId,
      reason: 'Simulated failure (mock gateway)',
    })
    return NextResponse.json({ ok: true, failed: true, orderId: payment.order.id })
  }

  const gatewayPaymentId = `mock_pay_${crypto.randomBytes(9).toString('hex')}`
  // Same dual-path as prod: webhook is the backstop, verify is the fast path.
  await postMockWebhook({
    event: 'payment.captured',
    gatewayOrderId,
    gatewayPaymentId,
  })
  return NextResponse.json({
    ok: true,
    orderId: payment.order.id,
    gatewayPaymentId,
    signature: mockSign(`${gatewayOrderId}|${gatewayPaymentId}`),
  })
}
