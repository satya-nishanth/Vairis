import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { OrderStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeOrderAmounts } from '@/lib/orders'
import { autoSplitOrder } from '@/lib/split'

export const dynamic = 'force-dynamic'

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
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
        // Editable: WhatsApp deals are negotiated, so the admin-entered
        // price wins over the computed gold-rate price.
        unitPrice: z.number().positive().max(10000000),
      }),
    )
    .min(1),
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
  await requireAdmin()

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
    include: { product: true },
  })
  const variantMap = new Map(variants.map((v) => [v.id, v]))
  for (const item of d.items) {
    if (!variantMap.has(item.variantId)) {
      return NextResponse.json({ error: `Variant ${item.variantId} not found` }, { status: 400 })
    }
  }

  const total = Math.round(d.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0))
  const { totalAmount, grandTotal, depositAmount } = computeOrderAmounts(total)

  const { order, childOrderIds } = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId: user.id,
        status: d.initialStatus,
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
        items: {
          create: d.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            price: Math.round(i.unitPrice),
            productName: variantMap.get(i.variantId)!.product.name,
          })),
        },
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
    })

    // Multi-item manual orders auto-split into one child per line item too
    // (same rule as online checkout, just triggered at creation instead of
    // at payment confirmation — see lib/split.ts).
    const childOrderIds = d.items.length >= 2 ? await autoSplitOrder(tx, created.id) : []
    return { order: created, childOrderIds }
  })

  return NextResponse.json(
    { orderId: order.id, ...(childOrderIds.length ? { childOrderIds } : {}) },
    { status: 201 },
  )
}
