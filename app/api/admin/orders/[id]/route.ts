import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { OrderStatus, Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  ADMIN_TRANSITIONS,
  OFFLINE_SETTLEMENT_TRANSITIONS,
  REASON_REQUIRED,
  REASON_REQUIRED_TARGETS,
  computeOrderAmounts,
} from '@/lib/orders'
import { getShippingProvider } from '@/lib/shipping'
import { sendOrderDeliveredEmail, sendOrderShippedEmail } from '@/lib/email'
import { sellingComponentsToUnitSnapshot, toOrderItemPriceSnapshot } from '@/lib/pricing'
import { getPricingConfig, resolvePricingConfig } from '@/lib/pricing-data'
import { toSetOrderItemSnapshot } from '@/lib/product-piece-pricing'
import {
  allocateInventoryForOrderItem,
  InventoryError,
  releaseInventoryAllocationsForOrder,
} from '@/lib/inventory'
import { inventoryActorFromSession } from '@/lib/inventory-audit'
import {
  internalBuildSchema,
  orderAttachmentInputSchema,
} from '@/lib/order-internal-build'

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
              ? 'Payment received offline'
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

const editOrderSchema = z.object({
  userId: z.string().min(1),
  contactName: z.string().trim().min(2),
  contactPhone: z.string().trim().regex(/^\d{10}$/, '10-digit mobile required'),
  addressLine1: z.string().trim().min(5),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  pincode: z.string().trim().regex(/^\d{6}$/, '6-digit pincode required'),
  note: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
        unitPrice: z.number().positive().max(10000000),
        inventoryItemId: z.string().min(1).optional(),
        internalBuild: internalBuildSchema.optional(),
      }),
    )
    .min(1),
  sellingBreakdown: z
    .object({
      gold: z.number().min(0).max(100000000),
      diamonds: z.number().min(0).max(100000000),
      stones: z.number().min(0).max(100000000),
      making: z.number().min(0).max(100000000),
      wastage: z.number().min(0).max(100000000),
      delivery: z.number().min(0).max(100000000),
      gst: z.number().min(0).max(100000000),
    })
    .optional(),
  /** Replace-all admin attachments. Omit to leave unchanged; pass [] to clear. */
  attachments: z.array(orderAttachmentInputSchema).max(30).optional(),
})

/**
 * PUT /api/admin/orders/[id] — rewrite customer, address, items, inventory
 * allocations, and optional selling breakdown. Releases existing allocations
 * then re-applies. Split parents are blocked (edit each child).
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const inventoryActor = inventoryActorFromSession(session)
  const { id } = await params

  const parsed = editOrderSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid order' },
      { status: 400 },
    )
  }
  const d = parsed.data

  const existing = await prisma.order.findUnique({
    where: { id },
    include: {
      children: { select: { id: true }, take: 1 },
      inventoryAllocations: { select: { inventoryItemId: true, qty: true } },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (existing.children.length > 0) {
    return NextResponse.json(
      { error: 'Split parent — edit each child delivery separately' },
      { status: 400 },
    )
  }

  const user = await prisma.user.findUnique({ where: { id: d.userId } })
  if (!user) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const releasedByItem = new Map<string, number>()
  for (const a of existing.inventoryAllocations) {
    releasedByItem.set(a.inventoryItemId, (releasedByItem.get(a.inventoryItemId) ?? 0) + a.qty)
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: d.items.map((i) => i.variantId) } },
    include: {
      product: {
        include: {
          pieces: true,
          variants: true,
          stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  })
  const variantMap = new Map(variants.map((v) => [v.id, v]))
  for (const item of d.items) {
    if (!variantMap.has(item.variantId)) {
      return NextResponse.json({ error: `Variant ${item.variantId} not found` }, { status: 400 })
    }
    if (item.inventoryItemId) {
      const inv = await prisma.inventoryItem.findUnique({
        where: { id: item.inventoryItemId },
        select: { id: true, variantId: true, qtyOnHand: true },
      })
      if (!inv) {
        return NextResponse.json({ error: 'Inventory item not found' }, { status: 400 })
      }
      if (!inv.variantId) {
        return NextResponse.json(
          { error: 'Inventory item must be linked to catalogue before selling' },
          { status: 400 },
        )
      }
      if (inv.variantId !== item.variantId) {
        return NextResponse.json({ error: 'Inventory item does not match selected variant' }, { status: 400 })
      }
      const available = inv.qtyOnHand + (releasedByItem.get(inv.id) ?? 0)
      if (available < item.quantity) {
        return NextResponse.json(
          { error: `Only ${available} unit(s) available in inventory` },
          { status: 400 },
        )
      }
    }
  }

  // Same inventory line may appear on multiple order lines — check combined demand.
  const demandByInv = new Map<string, number>()
  for (const item of d.items) {
    if (!item.inventoryItemId) continue
    demandByInv.set(item.inventoryItemId, (demandByInv.get(item.inventoryItemId) ?? 0) + item.quantity)
  }
  for (const [invId, demand] of demandByInv) {
    const inv = await prisma.inventoryItem.findUnique({
      where: { id: invId },
      select: { qtyOnHand: true },
    })
    if (!inv) continue
    const available = inv.qtyOnHand + (releasedByItem.get(invId) ?? 0)
    if (available < demand) {
      return NextResponse.json(
        { error: `Only ${available} unit(s) available in inventory for one of the lines` },
        { status: 400 },
      )
    }
  }

  const [goldRates, pricingConfig] = await Promise.all([
    prisma.goldRate.findMany(),
    getPricingConfig(),
  ])
  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))

  const total = Math.round(d.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0))

  if (d.sellingBreakdown) {
    const sellingTotal =
      d.sellingBreakdown.gold +
      d.sellingBreakdown.diamonds +
      d.sellingBreakdown.stones +
      d.sellingBreakdown.making +
      d.sellingBreakdown.wastage +
      d.sellingBreakdown.delivery +
      d.sellingBreakdown.gst
    if (Math.round(sellingTotal) !== total) {
      return NextResponse.json(
        { error: `Selling breakdown (₹${Math.round(sellingTotal)}) doesn't match goods total (₹${total})` },
        { status: 400 },
      )
    }
  }

  const { totalAmount, grandTotal, depositAmount } = computeOrderAmounts(total)

  const itemRows = d.items.map((i, index) => {
    const v = variantMap.get(i.variantId)!
    const rate = rateMap[v.metalType]
    let priceBreakdown = undefined as ReturnType<typeof toOrderItemPriceSnapshot> | undefined

    const manual = d.sellingBreakdown
    const manualTotal =
      manual != null
        ? manual.gold +
          manual.diamonds +
          manual.stones +
          manual.making +
          manual.wastage +
          manual.delivery +
          manual.gst
        : 0

    if (index === 0 && manual != null && manualTotal > 0) {
      priceBreakdown = sellingComponentsToUnitSnapshot(manual, {
        quantity: i.quantity,
        goldRatePerGram: rate ?? 0,
        weightGrams: Number(v.weightGrams),
        metalType: v.metalType,
        vaLabel: resolvePricingConfig(pricingConfig, v.product).vaLabel,
      })
    } else if (rate != null) {
      const snapshot = toSetOrderItemSnapshot(
        v,
        v.product.variants,
        rateMap,
        pricingConfig,
        v.product.stones,
        {
          vaGoldPct: v.product.vaGoldPct != null ? Number(v.product.vaGoldPct) : null,
          vaLabel: v.product.vaLabel,
        },
        v.product.pieces.map((p) => ({
          id: p.id,
          vaGoldPct: p.vaGoldPct != null ? Number(p.vaGoldPct) : null,
          vaLabel: p.vaLabel,
        })),
        false,
      )
      if (snapshot) priceBreakdown = snapshot
    }
    const row: Prisma.OrderItemUncheckedCreateWithoutOrderInput = {
      variantId: i.variantId,
      quantity: i.quantity,
      price: Math.round(i.unitPrice),
      productName: v.product.name,
    }
    if (priceBreakdown) {
      row.priceBreakdown = priceBreakdown as unknown as Prisma.InputJsonValue
    }
    if (i.internalBuild) {
      row.internalBuild = i.internalBuild as unknown as Prisma.InputJsonValue
    }
    return row
  })

  try {
    await prisma.$transaction(async (tx) => {
      await releaseInventoryAllocationsForOrder(tx, { orderId: id, actor: inventoryActor })
      await tx.orderItem.deleteMany({ where: { orderId: id } })

      if (d.attachments !== undefined) {
        await tx.orderAttachment.deleteMany({ where: { orderId: id } })
        if (d.attachments.length > 0) {
          await tx.orderAttachment.createMany({
            data: d.attachments.map((a) => ({
              orderId: id,
              url: a.url,
              fileName: a.fileName,
              contentType: a.contentType ?? '',
            })),
          })
        }
      }

      await tx.order.update({
        where: { id },
        data: {
          userId: user.id,
          totalAmount,
          depositAmount,
          grandTotal,
          contactName: d.contactName,
          contactPhone: d.contactPhone,
          addressLine1: d.addressLine1,
          addressLine2: d.addressLine2 || null,
          city: d.city,
          state: d.state,
          pincode: d.pincode,
          events: {
            create: {
              status: existing.status,
              note: d.note?.trim() || 'Order details updated by admin (customer / address / items)',
            },
          },
        },
      })

      for (let i = 0; i < itemRows.length; i++) {
        const row = itemRows[i]!
        const src = d.items[i]!
        const orderItem = await tx.orderItem.create({
          data: { ...row, orderId: id },
        })
        if (src.inventoryItemId) {
          await allocateInventoryForOrderItem(tx, {
            inventoryItemId: src.inventoryItemId,
            orderId: id,
            orderItemId: orderItem.id,
            variantId: src.variantId,
            qty: src.quantity,
            actor: inventoryActor,
          })
        }
      }
    })
  } catch (err) {
    if (err instanceof InventoryError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  return NextResponse.json({ ok: true, orderId: id })
}
