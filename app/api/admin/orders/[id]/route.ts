import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { OrderStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  ADMIN_TRANSITIONS,
  OFFLINE_SETTLEMENT_TRANSITIONS,
  REASON_REQUIRED,
  REASON_REQUIRED_TARGETS,
} from '@/lib/orders'
import { getShippingProvider } from '@/lib/shipping'
import { sendOrderDeliveredEmail, sendOrderShippedEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Union of every "to" value across ADMIN_TRANSITIONS and
// OFFLINE_SETTLEMENT_TRANSITIONS (lib/orders.ts) — every status the admin
// can ever PATCH an order into.
const patchSchema = z.object({
  status: z.enum([
    'PAYMENT_CONFIRMED',
    'PREPARING',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'DELIVERY_FAILED',
    'RETURNING_TO_ORIGIN',
    'RTO_RECEIVED',
    'RETURN_REQUESTED',
    'RETURN_IN_TRANSIT',
    'RETURN_RECEIVED',
    'DEPOSIT_REFUNDED',
    'CANCELLED',
    'REFUNDED',
    'FAILED_OTHER',
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
    include: {
      shipments: { orderBy: { dispatchedAt: 'desc' } },
      payment: true,
      parent: { include: { payment: true } },
    },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Offline orders (no gateway payment) additionally get manual settlement
  // marks — gateway-paid orders must use the refund endpoint instead.
  // Split children never carry their own Payment row (it lives on the
  // parent — see lib/refunds.ts resolvePayment); walk up the same way so a
  // gateway-paid child isn't misclassified as offline.
  const isOffline = !(order.payment ?? order.parent?.payment ?? null)
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

  // International orders need an explicit admin approval before
  // fulfillment starts — Sequel247 is India-domestic only, so someone has
  // to manually arrange delivery. A flag + banner alone wouldn't actually
  // stop an admin from clicking through, so this blocks the transition.
  if (nextStatus === 'PREPARING' && order.intlReviewRequired && !order.intlReviewApproved) {
    return NextResponse.json(
      { error: 'International order pending review — approve it first' },
      { status: 409 },
    )
  }

  // Reason enforcement (lib/orders REASON_REQUIRED / REASON_REQUIRED_TARGETS)
  const reasonRequired =
    REASON_REQUIRED.some(([f, t]) => f === order.status && t === nextStatus) ||
    REASON_REQUIRED_TARGETS.includes(nextStatus as OrderStatus)
  if (reasonRequired && !note?.trim()) {
    const msg =
      order.status === 'PAYMENT_PENDING' && nextStatus === 'PAYMENT_CONFIRMED'
        ? 'URN / transaction ID is required to mark paid offline'
        : 'A reason note is required for this transition'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Return-request reject must revert to the exact pre-request status
  if (order.status === 'RETURN_REQUESTED' && (nextStatus === 'DELIVERED' || nextStatus === 'DEPOSIT_REFUNDED')) {
    const events = await prisma.orderEvent.findMany({ where: { orderId: id }, orderBy: { createdAt: 'desc' } })
    const requestIdx = events.findIndex((e) => e.status === 'RETURN_REQUESTED')
    const prior = events.slice(requestIdx + 1).find((e) => e.status !== 'RETURN_REQUESTED')?.status
    if (prior !== nextStatus) {
      return NextResponse.json({ error: `Reject must revert to ${prior ?? 'the previous status'}` }, { status: 409 })
    }
  }

  // SHIPPED requires shipping details. Manual provider = admin types them;
  // partner adapters (Shiprocket/DTDC, supportsBooking=true) book via API
  // here and fill them in. Manually-typed values always win as override.
  let shipCourierName = courierName
  let shipAwbCode = awbCode
  let shipTrackingUrl = trackingUrl
  let providerShipmentId: string | null = null
  if (nextStatus === 'SHIPPED') {
    const provider = getShippingProvider(order.country)
    if (!provider.supportsBooking && (!courierName || !awbCode)) {
      return NextResponse.json(
        { error: 'Courier name and AWB number are required to mark as shipped' },
        { status: 400 },
      )
    }
    if (provider.supportsBooking && (!courierName || !awbCode)) {
      try {
        const booking = await provider.bookShipment({
          orderId: order.id,
          contactName: order.contactName,
          contactPhone: order.contactPhone,
          addressLine1: order.addressLine1,
          addressLine2: order.addressLine2,
          city: order.city,
          state: order.state,
          pincode: order.pincode,
          declaredValue: Number(order.grandTotal),
        })
        shipCourierName = booking.courierName
        shipAwbCode = booking.awbCode
        shipTrackingUrl = booking.trackingUrl ?? undefined
        providerShipmentId = booking.providerShipmentId
      } catch (err) {
        console.error(`[admin/orders] ${provider.name} booking failed`, err)
        return NextResponse.json(
          { error: `Shipment booking via ${provider.name} failed — retry or enter courier details manually` },
          { status: 502 },
        )
      }
    }
  }

  const eventNote =
    note ??
    (nextStatus === 'SHIPPED'
      ? `Shipped via ${shipCourierName}${shipAwbCode ? ` (AWB ${shipAwbCode})` : ''}`
      : nextStatus === 'DELIVERED'
        ? Number(order.depositAmount) > 0
          ? 'Delivered — security deposit refund due'
          : 'Delivered'
        : nextStatus === 'DEPOSIT_REFUNDED'
          ? 'Security deposit returned (offline settlement)'
          : nextStatus === 'REFUNDED'
            ? 'Amount refunded (offline settlement)'
            : nextStatus === 'PAYMENT_CONFIRMED'
              ? note?.trim() || 'Payment received offline'
              : nextStatus === 'RETURN_REQUESTED'
                ? 'Return requested (admin)'
                : nextStatus === 'RETURN_IN_TRANSIT'
                  ? 'Return pickup arranged'
                  : nextStatus === 'RTO_RECEIVED'
                    ? 'Package received back at origin'
                    : nextStatus === 'RETURNING_TO_ORIGIN'
                      ? 'Package returning to origin'
                      : nextStatus === 'OUT_FOR_DELIVERY'
                        ? 'Out for delivery'
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
          courierName: shipCourierName ?? null,
          awbCode: shipAwbCode ?? null,
          trackingUrl: shipTrackingUrl || null,
          shiprocketId: providerShipmentId,
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

    const latest = order.shipments[0] ?? null

    if (nextStatus === 'DELIVERY_FAILED' && latest) {
      await tx.shipment.update({
        where: { id: latest.id },
        data: { attempts: { increment: 1 }, status: 'ATTEMPT_FAILED' },
      })
    }

    if (nextStatus === 'RETURNING_TO_ORIGIN' && latest) {
      await tx.shipment.update({
        where: { id: latest.id },
        data: { outcome: 'RTO', status: 'RETURNING_TO_ORIGIN' },
      })
    }
  })

  // Customer notifications — best-effort, never block the transition.
  if (nextStatus === 'SHIPPED') void sendOrderShippedEmail(id)
  if (nextStatus === 'DELIVERED') void sendOrderDeliveredEmail(id)

  return NextResponse.json({ ok: true })
}
