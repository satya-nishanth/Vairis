import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAppUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculatePrice } from '@/lib/pricing'
import { getPricingConfig, toStoneInputs } from '@/lib/pricing-data'
import { computeOrderAmounts } from '@/lib/orders'
import { validatePromo } from '@/lib/promo'
import { getPaymentGateway } from '@/lib/payments'
import { checkPincodeServiceability } from '@/lib/shipping/sequel247-validate'
import { checkIndiaFormat } from '@/lib/address-schema'

export const dynamic = 'force-dynamic'

// Mirrors lib/address-schema.ts's addressSchema shape but keeps checkout's
// existing addressLine1/addressLine2 field names (vs line1/line2 there) —
// the India-format check itself is shared via checkIndiaFormat so the two
// schemas can't drift on what "valid" means.
const checkoutAddressSchema = z.object({
  contactName: z.string().trim().min(2, 'Name is required'),
  contactPhone: z.string().trim().min(1, 'Phone number is required'),
  addressLine1: z.string().trim().min(5, 'Address is required'),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State is required'),
  pincode: z.string().trim().min(1, 'Pincode is required'),
  country: z.string().trim().min(2, 'Country is required').max(60).default('IN'),
  promoCode: z.string().trim().max(40).optional(),
}).superRefine(checkIndiaFormat)

/**
 * POST /api/checkout — create an Order from the user's cart plus a matching
 * gateway payment intent for grandTotal (= goods total; see lib/orders.ts).
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
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const parsed = checkoutAddressSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid address' },
      { status: 400 },
    )
  }
  const address = parsed.data

  const [cartItems, goldRates, pricingConfig] = await Promise.all([
    prisma.cartItem.findMany({
      where: { userId: user.id },
      include: {
        variant: {
          include: {
            product: {
              include: {
                stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
  ])

  if (cartItems.length === 0) {
    return NextResponse.json({ error: 'EMPTY_CART', message: 'Your cart is empty' }, { status: 400 })
  }

  // India addresses are checked against Sequel247's serviceability API,
  // same as the address book (lib/shipping/sequel247-validate.ts). Run
  // this before any pricing work or Order row is created.
  if (address.country === 'IN') {
    const serviceability = await checkPincodeServiceability(address.pincode)
    if (!serviceability.ok) {
      return NextResponse.json(
        { error: 'VALIDATION', message: 'Enter a valid pincode' },
        { status: 400 },
      )
    }
  }

  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))

  // Server-side price snapshot per line (same formula the PDP shows) —
  // stones priced at the per-carat rate for the item's exchange choice.
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
        {
          stones: toStoneInputs(item.variant.product.stones),
          withExchange: item.withExchange,
          config: pricingConfig,
        },
      ).total,
    )
    return {
      variantId: item.variantId,
      productName: item.variant.product.name,
      quantity: item.quantity,
      unitPrice,
      withExchange: item.withExchange,
    }
  })

  const goodsTotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)

  // Promo (server-validated; discount applies to the goods total)
  let discountAmount = 0
  let promoCodeId: string | null = null
  if (address.promoCode) {
    const promoResult = await validatePromo(address.promoCode, user.id, goodsTotal)
    if (!promoResult.ok) {
      return NextResponse.json(
        { error: 'PROMO_INVALID', message: promoResult.reason },
        { status: 422 },
      )
    }
    discountAmount = promoResult.discount
    promoCodeId = promoResult.promo.id
  }

  const { totalAmount, grandTotal, depositAmount } = computeOrderAmounts(
    goodsTotal - discountAmount,
  )

  // Create our Order first (PAYMENT_PENDING), then the gateway intent with our id
  // as reference so dashboard entries reconcile 1:1.
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      status: 'PAYMENT_PENDING',
      totalAmount,
      depositAmount,
      grandTotal,
      discountAmount,
      promoCodeId,
      contactName: address.contactName,
      contactPhone: address.contactPhone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || null,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country,
      intlReviewRequired: address.country !== 'IN',
      items: {
        create: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          price: l.unitPrice,
          productName: l.productName,
          withExchange: l.withExchange,
        })),
      },
      events: {
        create: {
          status: 'PAYMENT_PENDING',
          note: discountAmount > 0 ? `Order created (promo −₹${discountAmount.toLocaleString('en-IN')})` : 'Order created',
        },
      },
    },
  })

  // Reserve the promo redemption against this order; released if the order
  // is cancelled before payment or swept as expired.
  if (promoCodeId) {
    await prisma.promoRedemption.create({
      data: { promoCodeId, userId: user.id, orderId: order.id, amount: discountAmount },
    })
  }

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
    await prisma.promoRedemption.deleteMany({ where: { orderId: order.id } })
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

  // Cart items are now owned by this order — clear them here, once a real
  // payment attempt exists (order + gateway intent both created), rather
  // than waiting for payment.captured. Previously cart only cleared on a
  // successful payment, so a pending, failed, or abandoned checkout left
  // the same items sitting in the cart alongside the order that already
  // has them, inviting an accidental double order. Cleared only after the
  // gateway intent succeeds — a gateway failure above cancels the order
  // and leaves the cart untouched, so retrying doesn't require re-adding
  // everything.
  await prisma.cartItem.deleteMany({ where: { userId: user.id } })

  return NextResponse.json({
    orderId: order.id,
    gateway: gateway.name,
    clientParams: intent.clientParams,
    contact: { name: address.contactName, phone: address.contactPhone, email: user.email },
  })
}
