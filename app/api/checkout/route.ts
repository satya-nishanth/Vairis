import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculatePrice } from '@/lib/pricing'
import { computeOrderAmounts } from '@/lib/orders'
import { getPaymentGateway } from '@/lib/payments'

export const dynamic = 'force-dynamic'

const checkoutSchema = z.object({
  contactName: z.string().trim().min(2, 'Name is required'),
  contactPhone: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit mobile number'),
  addressLine1: z.string().trim().min(5, 'Address is required'),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State is required'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit pincode'),
})

/**
 * POST /api/checkout — create an Order from the user's cart plus a matching
 * gateway payment intent for grandTotal (105% of goods total — the 5%
 * security deposit model; see lib/orders.ts).
 *
 * Gateway-agnostic: talks only to the PaymentGateway port (lib/payments).
 * Prices are recomputed server-side from the DB + current gold rates —
 * client-supplied amounts are never trusted.
 *
 * NOT YET CONFIGURED: until gateway keys are in env this returns 503 and
 * the checkout page shows a "payment setup in progress" notice. No Order
 * rows are created in that case.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser()
  const gateway = getPaymentGateway()

  if (!gateway.isConfigured()) {
    return NextResponse.json(
      {
        error: 'PAYMENTS_NOT_CONFIGURED',
        message: `Online payment is being set up (gateway: ${gateway.name}). See lib/payments/${gateway.name}.ts for the env keys to add.`,
      },
      { status: 503 },
    )
  }

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid address' },
      { status: 400 },
    )
  }
  const address = parsed.data

  const [cartItems, goldRates] = await Promise.all([
    prisma.cartItem.findMany({
      where: { userId: user.id },
      include: { variant: { include: { product: true } } },
    }),
    prisma.goldRate.findMany(),
  ])

  if (cartItems.length === 0) {
    return NextResponse.json({ error: 'EMPTY_CART', message: 'Your cart is empty' }, { status: 400 })
  }

  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))

  // Server-side price snapshot per line (same formula the PDP shows)
  const lines = cartItems.map((item) => {
    const rate = rateMap[item.variant.metalType]
    if (!rate) {
      throw new Error(`No gold rate for ${item.variant.metalType} — cannot price order`)
    }
    const unitPrice = Math.round(
      calculatePrice(
        {
          weightGrams: item.variant.weightGrams.toString(),
          makingChargePerGram: item.variant.makingChargePerGram.toString(),
          flatMakingCharge: item.variant.flatMakingCharge.toString(),
          stoneCharges: item.variant.stoneCharges.toString(),
          miscCharges: item.variant.miscCharges.toString(),
        },
        rate,
      ).total,
    )
    return {
      variantId: item.variantId,
      productName: item.variant.product.name,
      quantity: item.quantity,
      unitPrice,
    }
  })

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  const { totalAmount, grandTotal, depositAmount } = computeOrderAmounts(total)

  // Create our Order first (PAYMENT_PENDING), then the gateway intent with our id
  // as reference so dashboard entries reconcile 1:1.
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      status: 'PAYMENT_PENDING',
      totalAmount,
      depositAmount,
      grandTotal,
      contactName: address.contactName,
      contactPhone: address.contactPhone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || null,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      items: {
        create: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          price: l.unitPrice,
          productName: l.productName,
        })),
      },
      events: { create: { status: 'PAYMENT_PENDING', note: 'Order created' } },
    },
  })

  let intent
  try {
    intent = await gateway.createPaymentIntent(grandTotal, order.id)
  } catch (err) {
    // Gateway rejected/unreachable — cancel the order so it never shows as
    // a stuck "payment pending" in the customer's order list.
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        events: { create: { status: 'CANCELLED', note: 'Payment gateway error before payment' } },
      },
    })
    console.error('checkout: payment intent creation failed', err)
    return NextResponse.json(
      { error: 'GATEWAY', message: 'Payment gateway error. Please try again.' },
      { status: 502 },
    )
  }

  await prisma.payment.create({
    data: {
      orderId: order.id,
      razorpayOrderId: intent.gatewayOrderId, // generic gateway id; column name historical
      status: 'CREATED',
      amount: grandTotal,
    },
  })

  return NextResponse.json({
    orderId: order.id,
    gateway: gateway.name,
    clientParams: intent.clientParams,
    contact: { name: address.contactName, phone: address.contactPhone, email: user.email },
  })
}
