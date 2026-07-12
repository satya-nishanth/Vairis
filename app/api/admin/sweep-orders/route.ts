import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sweep-orders — expire stale unpaid orders.
 * Cron-called (GitHub Actions hourly — never Vercel cron), Bearer-authed
 * with ORDER_SWEEP_SECRET.
 *
 * Race-safe by construction, not by snapshot: the UPDATE below re-checks
 * status = PAYMENT_PENDING and "no CAPTURED payment" at write time inside
 * the same statement, so a payment.captured webhook landing between the
 * candidate scan and this order's turn in the loop can never be clobbered
 * back to PAYMENT_EXPIRED — the WHERE simply matches zero rows and we skip
 * writing the event.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ORDER_SWEEP_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const hours = Number(process.env.ORDER_EXPIRY_HOURS ?? 24)
  const cutoff = new Date(Date.now() - hours * 3600_000)

  const stale = await prisma.order.findMany({
    where: { status: 'PAYMENT_PENDING', createdAt: { lt: cutoff } },
    select: { id: true },
  })

  let expired = 0
  for (const order of stale) {
    const updated = await prisma.$executeRaw`
      UPDATE "Order" SET status = 'PAYMENT_EXPIRED'::"OrderStatus"
      WHERE id = ${order.id}
        AND status = 'PAYMENT_PENDING'::"OrderStatus"
        AND NOT EXISTS (
          SELECT 1 FROM "Payment" WHERE "orderId" = ${order.id} AND status = 'CAPTURED'::"PaymentStatus"
        )
    `
    if (updated === 0) continue // captured (or already resolved) between scan and write — leave it alone

    await prisma.orderEvent.create({
      data: { orderId: order.id, status: 'PAYMENT_EXPIRED', note: `No payment within ${hours}h — order expired` },
    })
    expired++
  }

  return NextResponse.json({ ok: true, checked: stale.length, expired })
}
