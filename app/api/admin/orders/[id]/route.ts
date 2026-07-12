import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { OrderStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ADMIN_TRANSITIONS, OFFLINE_SETTLEMENT_TRANSITIONS } from '@/lib/orders'
import { getShippingProvider } from '@/lib/shipping'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  status: z.enum([
    'PREPARING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    // offline-only settlement marks (see OFFLINE_SETTLEMENT_TRANSITIONS)
    'PAYMENT_CONFIRMED',
    'DEPOSIT_REFUNDED',
    'REFUNDED',
  ]),
  note: z.string().trim().max(500).optional(),
  // Shipping details — required when marking SHIPPED with the manual
  // provider (delivery partner not integrated yet; see lib/shipping).
  courierName: z.string().trim().optional(),
  awbCode: z.string().trim().optional(),
  trackingUrl: z.string().trim().url().optional().or(z.literal('')),
})

/**
 * PATCH /api/admin/orders/[id] — admin-driven status transitions.
 * Valid moves come from ADMIN_TRANSITIONS (lib/orders.ts); webhook-driven
 * transitions (payment confirmation, refunds) have their own endpoints.
 * Every transition appends an OrderEvent for the customer timeline.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }
  const { status: nextStatus, note, courierName, awbCode, trackingUrl } = parsed.data

  const order = await prisma.order.findUnique({
    where: { id },
    include: { shipments: { orderBy: { dispatchedAt: 'desc' } }, payment: true },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Offline orders (no gateway payment) additionally get manual settlement
  // marks — gateway-paid orders must use the refund endpoint instead.
  const isOffline = !order.payment
  const allowed = [
    ...(ADMIN_TRANSITIONS[order.status] ?? []),
    ...(isOffline ? (OFFLINE_SETTLEMENT_TRANSITIONS[order.status] ?? []) : []),
  ]
  if (!allowed.includes(nextStatus as OrderStatus)) {
    return NextResponse.json(
      { error: `Cannot move ${order.status} → ${nextStatus}. Allowed: ${allowed.join(', ') || 'none'}` },
      { status: 409 },
    )
  }

  // SHIPPED requires shipping details. Manual provider = admin types them;
  // a future partner adapter (supportsBooking=true) will book via API and
  // fill these itself.
  if (nextStatus === 'SHIPPED') {
    const provider = getShippingProvider()
    if (!provider.supportsBooking && (!courierName || !awbCode)) {
      return NextResponse.json(
        { error: 'Courier name and AWB number are required to mark as shipped' },
        { status: 400 },
      )
    }
  }

  const eventNote =
    note ??
    (nextStatus === 'SHIPPED'
      ? `Shipped via ${courierName}${awbCode ? ` (AWB ${awbCode})` : ''}`
      : nextStatus === 'DELIVERED'
        ? Number(order.depositAmount) > 0
          ? 'Delivered — security deposit refund due'
          : 'Delivered'
        : nextStatus === 'DEPOSIT_REFUNDED'
          ? 'Security deposit returned (offline settlement)'
          : nextStatus === 'REFUNDED'
            ? 'Amount refunded (offline settlement)'
            : nextStatus === 'PAYMENT_CONFIRMED'
              ? 'Payment received offline'
              : undefined)

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id },
      data: {
        status: nextStatus,
        events: { create: { status: nextStatus, note: eventNote ?? null } },
      },
    })

    if (nextStatus === 'SHIPPED') {
      await tx.shipment.create({
        data: {
          orderId: id,
          courierName: courierName ?? null,
          awbCode: awbCode ?? null,
          trackingUrl: trackingUrl || null,
          status: 'IN_TRANSIT',
        },
      })
    }

    if (nextStatus === 'DELIVERED') {
      const latest = order.shipments[0]
      if (latest) {
        await tx.shipment.update({
          where: { id: latest.id },
          data: { status: 'DELIVERED', outcome: 'DELIVERED' },
        })
      }
    }

    // DELIVERY_FAILED / RETURNING_TO_ORIGIN aren't reachable via the zod
    // enum yet (Task 4 expands it) — these blocks are ready for when it does.
    const latest = order.shipments[0] ?? null

    if ((nextStatus as OrderStatus) === 'DELIVERY_FAILED' && latest) {
      await tx.shipment.update({
        where: { id: latest.id },
        data: { attempts: { increment: 1 }, status: 'ATTEMPT_FAILED' },
      })
    }

    if ((nextStatus as OrderStatus) === 'RETURNING_TO_ORIGIN' && latest) {
      await tx.shipment.update({
        where: { id: latest.id },
        data: { outcome: 'RTO', status: 'RETURNING_TO_ORIGIN' },
      })
    }
  })

  return NextResponse.json({ ok: true })
}
