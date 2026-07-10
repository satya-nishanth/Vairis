import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const trackSchema = z.object({
  orderId: z.string().trim().min(6),
  email: z.string().trim().email(),
})

/**
 * POST /api/track-order — public order lookup (no login).
 * Requires BOTH the order id and the purchase email so an order id alone
 * leaks nothing. Response is intentionally minimal: status timeline +
 * shipment info, no amounts, no address.
 */
export async function POST(req: NextRequest) {
  const parsed = trackSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your order ID and email' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: {
      events: { orderBy: { createdAt: 'asc' } },
      shipment: true,
      user: { select: { email: true } },
    },
  })

  // Same response for wrong id and wrong email — no account enumeration.
  if (!order || order.user.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    return NextResponse.json(
      { error: 'No order found for that ID and email combination' },
      { status: 404 },
    )
  }

  return NextResponse.json({
    orderId: order.id,
    status: order.status,
    placedAt: order.createdAt,
    events: order.events.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt })),
    shipment: order.shipment
      ? {
          courierName: order.shipment.courierName,
          awbCode: order.shipment.awbCode,
          trackingUrl: order.shipment.trackingUrl,
        }
      : null,
  })
}
