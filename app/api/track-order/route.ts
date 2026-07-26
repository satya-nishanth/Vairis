import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
import { rateLimit } from '@/lib/rate-limit'

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
  const limited = rateLimit(req, 'track-order', 10)
  if (limited) return limited

  const parsed = trackSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your order ID and email' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    include: {
      events: { orderBy: { createdAt: 'asc' } },
      shipments: { orderBy: { dispatchedAt: 'desc' } },
      notes: { orderBy: { createdAt: 'asc' } },
      user: { select: { email: true } },
      children: {
        include: {
          events: { orderBy: { createdAt: 'asc' } },
          shipments: { orderBy: { dispatchedAt: 'desc' } },
          notes: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  // Same response for wrong id and wrong email — no account enumeration.
  if (!order || order.user.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    return NextResponse.json(
      { error: 'No order found for that ID and email combination' },
      { status: 404 },
    )
  }

  const isSplitParent = order.status === 'SPLIT_INTO_DELIVERIES' && order.children.length > 0

  return NextResponse.json({
    orderId: order.id,
    status: order.status,
    placedAt: order.createdAt,
    events: order.events.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt })),
    notes: order.notes
      .filter((n) => !n.internal)
      .map((n) => ({ body: n.body, createdAt: n.createdAt })),
    shipment: order.shipments[0]
      ? {
          courierName: order.shipments[0].courierName,
          awbCode: order.shipments[0].awbCode,
          trackingUrl: order.shipments[0].trackingUrl,
        }
      : null,
    ...(isSplitParent
      ? {
          children: order.children.map((c) => ({
            orderId: c.id,
            status: c.status,
            events: c.events.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt })),
            notes: c.notes
              .filter((n) => !n.internal)
              .map((n) => ({ body: n.body, createdAt: n.createdAt })),
            shipment: c.shipments[0]
              ? {
                  courierName: c.shipments[0].courierName,
                  awbCode: c.shipments[0].awbCode,
                  trackingUrl: c.shipments[0].trackingUrl,
                }
              : null,
          })),
        }
      : {}),
  })
}
