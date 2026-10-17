import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { OrderStatus, Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeOrderAmounts } from '@/lib/orders'
import { autoSplitOrder } from '@/lib/split'
import { closeThread } from '@/lib/quotations'
import {
  roundMoney,
  sellingBreakdownMatchesGoods,
  sellingComponentsToUnitSnapshot,
  toOrderItemPriceSnapshot,
} from '@/lib/pricing'
import { getPricingConfig, resolvePricingConfig } from '@/lib/pricing-data'
import { toSetOrderItemSnapshot } from '@/lib/product-piece-pricing'
import { allocateInventoryForOrderItem, InventoryError } from '@/lib/inventory'
import { inventoryActorFromSession } from '@/lib/inventory-audit'
import {
  internalBuildSchema,
  orderAttachmentInputSchema,
} from '@/lib/order-internal-build'

export const dynamic = 'force-dynamic'

/** Thrown inside the transaction when a supplied quotationId isn't in a convertible state. */
class ConvertConflictError extends Error {}

/** GET /api/admin/orders?status=SHIPPED — admin order list (all statuses when omitted). */
export async function GET(req: NextRequest) {
  await requireAdmin()

  const status = req.nextUrl.searchParams.get('status') as OrderStatus | null
  const orders = await prisma.order.findMany({
    where: status ? { status } : undefined,
    include: {
      items: true,
      payment: { select: { status: true, refundedAmount: true } },
      user: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json(orders)
}

const manualOrderSchema = z.object({
  userId: z.string().min(1),
  contactName: z.string().trim().min(2),
  contactPhone: z.string().trim().regex(/^\d{10}$/, '10-digit mobile required'),
  addressLine1: z.string().trim().min(5),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  pincode: z.string().trim().regex(/^\d{6}$/, '6-digit pincode required'),
  /** Deposit model retired — accepted for backwards compatibility, ignored. */
  applyDeposit: z.boolean().optional(),
  /** PAYMENT_PENDING = money not received yet; PAYMENT_CONFIRMED = paid via UPI/bank. */
  initialStatus: z.enum(['PAYMENT_PENDING', 'PAYMENT_CONFIRMED']),
  /** e.g. "Paid via GPay ref 12345" — lands in the order timeline. */
  paymentNote: z.string().trim().max(300).optional(),
  /** Calendar date money was received (YYYY-MM-DD) — invoice "Received On". */
  paymentReceivedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required')
    .optional(),
  /** When set, this order converts the quotation (must be QUOTED) inside the same transaction. */
  quotationId: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
        // Editable: WhatsApp deals are negotiated, so the admin-entered
        // price wins over the computed gold-rate price.
        unitPrice: z.number().positive().max(10000000),
        /** When set, decrements this inventory line inside the same transaction. */
        inventoryItemId: z.string().min(1).optional(),
        /** Admin-only physical build — not customer-visible. */
        internalBuild: internalBuildSchema.optional(),
      }),
    )
    .min(1),
  /**
   * Optional selling-price components (order totals). Stored on the first
   * order item as priceBreakdown. Purchase/cost stays finance-only.
   */
  sellingBreakdown: z
    .object({
      gold: z.number().min(0).max(100000000),
      diamonds: z.number().min(0).max(100000000),
      stones: z.number().min(0).max(100000000),
      making: z.number().min(0).max(100000000),
      wastage: z.number().min(0).max(100000000),
      /** Legacy flat misc; prefer miscLines when present. */
      delivery: z.number().min(0).max(100000000).optional().default(0),
      miscLines: z
        .array(
          z.object({
            label: z.string(),
            amount: z.number().min(0).max(100000000),
          }),
        )
        .optional(),
      /** Fixed certification fee (order-level ₹). */
      certification: z.number().min(0).max(100000000).optional().default(0),
      gst: z.number().min(0).max(100000000),
      /** Subtracted after GST; net must match goods total. */
      discount: z.number().min(0).max(100000000).optional().default(0),
    })
    .optional(),
  /** Admin-only attachments (images + PDF). */
  attachments: z.array(orderAttachmentInputSchema).max(30).optional(),
})

/**
 * POST /api/admin/orders — MANUAL order entry for offline/WhatsApp sales.
 *
 * Until Razorpay is fully live the storefront runs in WhatsApp-enquiry mode
 * (see lib/flags.ts); deals close in chat and an admin records them here so
 * the customer gets the normal order journey (My Orders, /track-order,
 * timeline, shipping updates).
 *
 * No Payment row is created — these orders settle offline (UPI/bank).
 * The PATCH route allows "mark deposit returned / mark refunded"
 * transitions for exactly these gateway-less orders.
 */
export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  const inventoryActor = inventoryActorFromSession(session)

  const parsed = manualOrderSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid order' },
      { status: 400 },
    )
  }
  const d = parsed.data

  const user = await prisma.user.findUnique({ where: { id: d.userId } })
  if (!user) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

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
      if (inv.qtyOnHand < item.quantity) {
        return NextResponse.json(
          { error: `Only ${inv.qtyOnHand} unit(s) available in inventory` },
          { status: 400 },
        )
      }
    }
  }

  const [goldRates, pricingConfig] = await Promise.all([
    prisma.goldRate.findMany(),
    getPricingConfig(),
  ])
  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))

  const total = roundMoney(d.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0))

  // Mirrors ManualOrderForm's own `sellingMismatch` warning (client-side only,
  // non-blocking) — reject server-side too, since priceBreakdown feeds
  // invoices and finance quotes and must not silently disagree with the
  // amount actually charged (order.price / totalAmount / grandTotal).
  if (
    d.sellingBreakdown &&
    !sellingBreakdownMatchesGoods(d.sellingBreakdown, total, { requireNetIfDiscounted: true })
  ) {
    const misc =
      d.sellingBreakdown.miscLines && d.sellingBreakdown.miscLines.length > 0
        ? d.sellingBreakdown.miscLines.reduce((s, l) => s + l.amount, 0)
        : d.sellingBreakdown.delivery ?? 0
    const gross =
      d.sellingBreakdown.gold +
      d.sellingBreakdown.diamonds +
      d.sellingBreakdown.stones +
      d.sellingBreakdown.making +
      d.sellingBreakdown.wastage +
      misc +
      (d.sellingBreakdown.certification ?? 0) +
      d.sellingBreakdown.gst
    const sellingTotal = roundMoney(gross - (d.sellingBreakdown.discount ?? 0))
    return NextResponse.json(
      { error: `Selling breakdown (₹${sellingTotal}) doesn't match goods total (₹${total})` },
      { status: 400 },
    )
  }

  const { totalAmount, grandTotal, depositAmount } = computeOrderAmounts(total)
  const orderDiscountAmount = roundMoney(d.sellingBreakdown?.discount ?? 0)

  const itemRows = d.items.map((i, index) => {
    const v = variantMap.get(i.variantId)!
    const rate = rateMap[v.metalType]
    let priceBreakdown = undefined as ReturnType<typeof toOrderItemPriceSnapshot> | undefined

    const manual = d.sellingBreakdown
    const manualMisc =
      manual != null
        ? manual.miscLines && manual.miscLines.length > 0
          ? manual.miscLines.reduce((s, l) => s + l.amount, 0)
          : manual.delivery ?? 0
        : 0
    const manualGross =
      manual != null
        ? manual.gold +
          manual.diamonds +
          manual.stones +
          manual.making +
          manual.wastage +
          manualMisc +
          (manual.certification ?? 0) +
          manual.gst +
          (manual.discount ?? 0)
        : 0

    if (index === 0 && manual != null && manualGross > 0) {
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
      price: roundMoney(i.unitPrice),
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

  let quotationThreadId: string | null = null
  let result: { order: { id: string }; childOrderIds: string[] }
  try {
    result = await prisma.$transaction(async (tx) => {
      let quotation = null
      if (d.quotationId) {
        // Atomically claim the quotation FIRST, before creating the order. This must happen
        // before order.create() — otherwise two truly concurrent requests can both pass a fast
        // unlocked check and both attempt to insert an Order row, racing on Order.quotationId's
        // unique constraint instead of failing cleanly here with a proper 409. Only one
        // concurrent transaction can ever win this conditional update (Postgres serializes
        // UPDATEs on the same row); the loser gets count===0 and throws before ever touching
        // order creation.
        const claimed = await tx.quotation.updateMany({
          where: { id: d.quotationId, status: 'QUOTED' },
          data: { status: 'CONVERTED' },
        })
        if (claimed.count === 0) {
          throw new ConvertConflictError()
        }
        quotation = await tx.quotation.findUniqueOrThrow({ where: { id: d.quotationId } })
      }

      const created = await tx.order.create({
        data: {
          userId: user.id,
          status: d.initialStatus,
          totalAmount,
          depositAmount,
          grandTotal,
          discountAmount: orderDiscountAmount,
          contactName: d.contactName,
          contactPhone: d.contactPhone,
          addressLine1: d.addressLine1,
          addressLine2: d.addressLine2 || null,
          city: d.city,
          state: d.state,
          pincode: d.pincode,
          quotationId: d.quotationId || null,
          paymentReceivedAt:
            d.initialStatus === 'PAYMENT_CONFIRMED' && d.paymentReceivedAt
              ? new Date(`${d.paymentReceivedAt}T12:00:00.000Z`)
              : null,
          items: {
            create: itemRows,
          },
          attachments:
            d.attachments && d.attachments.length > 0
              ? {
                  create: d.attachments.map((a) => ({
                    url: a.url,
                    fileName: a.fileName,
                    contentType: a.contentType ?? '',
                  })),
                }
              : undefined,
          events: {
            create: [
              { status: 'PAYMENT_PENDING' as const, note: 'Manual order created by admin (offline sale)' },
              ...(d.initialStatus === 'PAYMENT_CONFIRMED'
                ? [
                    {
                      status: 'PAYMENT_CONFIRMED' as const,
                      note: d.paymentNote || 'Payment received offline',
                    },
                  ]
                : []),
            ],
          },
        },
        include: { items: true },
      })

      for (let i = 0; i < d.items.length; i++) {
        const src = d.items[i]
        const orderItem = created.items[i]
        if (!orderItem) continue
        if (src.inventoryItemId) {
          await allocateInventoryForOrderItem(tx, {
            inventoryItemId: src.inventoryItemId,
            orderId: created.id,
            orderItemId: orderItem.id,
            variantId: src.variantId,
            qty: src.quantity,
            actor: inventoryActor,
          })
        }
      }

      // Multi-item manual orders auto-split into one child per line item too
      // (same rule as online checkout, just triggered at creation instead of
      // at payment confirmation — see lib/split.ts).
      const childOrderIds = d.items.length >= 2 ? await autoSplitOrder(tx, created.id) : []

      if (quotation) {
        // status is already CONVERTED from the claim above — just link the orderId now that we
        // have it.
        await tx.quotation.update({
          where: { id: quotation.id },
          data: { orderId: created.id },
        })
        quotationThreadId = quotation.discordThreadId
      }

      return { order: created, childOrderIds }
    })
  } catch (err) {
    if (err instanceof ConvertConflictError) {
      return NextResponse.json({ error: 'Quotation already converted or cancelled' }, { status: 409 })
    }
    if (err instanceof InventoryError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  if (quotationThreadId) {
    try {
      await closeThread(quotationThreadId, `✅ Converted → Order #${result.order.id.slice(-8)}`)
    } catch (err) {
      console.error('[api/admin/orders] closeThread on convert failed', err)
    }
  }

  return NextResponse.json(
    {
      orderId: result.order.id,
      ...(result.childOrderIds.length ? { childOrderIds: result.childOrderIds } : {}),
    },
    { status: 201 },
  )
}
