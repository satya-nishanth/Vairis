import { NextRequest, NextResponse } from 'next/server'
import { getPaymentGateway } from '@/lib/payments'
import { applyPaymentWebhookEvent } from '@/lib/payments/webhook-handlers'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/payment — gateway-agnostic webhook endpoint.
 * The active gateway adapter verifies the signature against the RAW body
 * and normalizes the provider payload; domain transitions live in
 * lib/payments/webhook-handlers.ts and never see provider-specific shapes.
 *
 * ─── NOT YET REGISTERED ──────────────────────────────────────────────────
 * Register in the Razorpay dashboard once deployed (Settings → Webhooks):
 *   URL:    https://<domain>/api/webhooks/payment
 *   Secret: value of RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.captured, payment.failed, refund.processed
 * Local dev: scripts/_simulate-webhook.mjs posts HMAC-signed events to
 * localhost — the full lifecycle is testable without a public URL.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function POST(req: NextRequest) {
  const gateway = getPaymentGateway()

  // Raw body first — webhook signatures cover the exact bytes.
  const rawBody = await req.text()
  const event = gateway.parseWebhook(rawBody, req.headers)

  if (event === null) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  await applyPaymentWebhookEvent(event)
  return NextResponse.json({ ok: true })
}
