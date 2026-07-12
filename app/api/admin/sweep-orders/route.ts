import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sweep-orders — expire stale unpaid orders.
 * Cron-called (GitHub Actions hourly — never Vercel cron), Bearer-authed
 * with ORDER_SWEEP_SECRET. Race-safe: any order whose payment is CAPTURED
 * is left for the capture webhook even if it looks stale.
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
    include: { payment: { select: { status: true } } },
  })

  let expired = 0
  for (const order of stale) {
    if (order.payment?.status === 'CAPTURED') continue // capture webhook owns it
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PAYMENT_EXPIRED',
        events: { create: { status: 'PAYMENT_EXPIRED', note: `No payment within ${hours}h — order expired` } },
      },
    })
    expired++
  }

  return NextResponse.json({ ok: true, checked: stale.length, expired })
}
