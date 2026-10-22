import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { PromoCode } from '@prisma/client'
export { couponKindSuffix, promoKindListLabel } from '@/lib/promo-labels'

const num = z.union([z.string(), z.number()]).transform(Number)

const PROMO_KINDS = [
  'PERCENT',
  'FLAT',
  'FREE_DELIVERY',
  'MAKING_PERCENT',
  'MAKING_FLAT',
] as const

const promoFields = {
  code: z
    .string()
    .trim()
    .min(3, 'Code must be at least 3 characters')
    .max(40, 'Code must be 40 characters or fewer')
    .transform((s) => s.toUpperCase().replace(/\s+/g, '')),
  description: z.string().trim().max(200).optional().nullable(),
  kind: z.enum(PROMO_KINDS),
  value: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => {
      // Omit → undefined (PATCH must not invent 0). Empty/null → 0 for create.
      if (v === undefined) return undefined
      if (v === '' || v === null) return 0
      return Number(v)
    }),
  minOrderValue: num.refine((n) => n >= 0),
  maxDiscount: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (v === '' || v === null) return null
      return Number(v)
    }),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  maxRedemptions: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (v === '' || v === null) return null
      return Number(v)
    }),
  maxPerUser: num.refine((n) => n >= 1),
  firstOrderOnly: z.boolean(),
  active: z.boolean(),
  /** Empty arrays = whole cart. Omit on PATCH to leave unchanged. */
  productIds: z.array(z.string()).optional(),
  collectionIds: z.array(z.string()).optional(),
  storeCategoryIds: z.array(z.string()).optional(),
  categories: z
    .array(z.enum(['RINGS', 'EARRINGS', 'PENDANTS', 'BRACELETS', 'NECKLACES']))
    .optional(),
} as const

function refinePromoValue(
  data: { kind?: (typeof PROMO_KINDS)[number]; value?: number },
  ctx: z.RefinementCtx,
) {
  // Partial PATCH may omit kind — skip value rules then.
  if (data.kind == null) return
  if (data.kind === 'FREE_DELIVERY') return
  if (data.value == null || !(data.value > 0)) {
    ctx.addIssue({ code: 'custom', message: 'Value must be positive', path: ['value'] })
  }
  if (
    (data.kind === 'PERCENT' || data.kind === 'MAKING_PERCENT') &&
    data.value != null &&
    data.value > 100
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Percent discount cannot exceed 100',
      path: ['value'],
    })
  }
}

/** Admin create payload (also used by the admin promos UI). */
export const promoSchema = z
  .object({
    ...promoFields,
    minOrderValue: promoFields.minOrderValue.default(0),
    maxPerUser: promoFields.maxPerUser.default(1),
    firstOrderOnly: promoFields.firstOrderOnly.optional().default(false),
    active: promoFields.active.default(true),
  })
  .superRefine(refinePromoValue)

/**
 * PATCH payload — no defaults. Omitted fields stay unchanged.
 * Prevents `{ active: false }` from inventing value:0 / resetting caps.
 */
export const promoPatchSchema = z
  .object({
    code: promoFields.code.optional(),
    description: promoFields.description,
    kind: promoFields.kind.optional(),
    value: promoFields.value,
    minOrderValue: promoFields.minOrderValue.optional(),
    maxDiscount: promoFields.maxDiscount,
    startsAt: promoFields.startsAt,
    endsAt: promoFields.endsAt,
    maxRedemptions: promoFields.maxRedemptions,
    maxPerUser: promoFields.maxPerUser.optional(),
    firstOrderOnly: promoFields.firstOrderOnly.optional(),
    active: promoFields.active.optional(),
    productIds: promoFields.productIds,
    collectionIds: promoFields.collectionIds,
    storeCategoryIds: promoFields.storeCategoryIds,
    categories: promoFields.categories,
  })
  .superRefine(refinePromoValue)

/** JSON-safe promo row (Prisma Decimal → number). */
export function serializePromo<T extends {
  value: { toString(): string } | number
  minOrderValue: { toString(): string } | number
  maxDiscount: { toString(): string } | number | null
}>(p: T) {
  return {
    ...p,
    value: Number(p.value),
    minOrderValue: Number(p.minOrderValue),
    maxDiscount: p.maxDiscount != null ? Number(p.maxDiscount) : null,
  }
}

/**
 * Promo code validation + discount math — single source of truth used by
 * the cart preview endpoint and the checkout order-create path (both
 * server-side; client-supplied discounts are never trusted).
 */

export type PromoResult =
  | { ok: true; promo: PromoCode; discount: number }
  | { ok: false; reason: string }

/** Bases for kind-specific coupon math (GST-inclusive ₹). */
export type PromoDiscountContext = {
  /** Eligible merchandise after automatic discount. */
  cartBase: number
  /** Eligible making (incl. GST share). */
  makingBase: number
  /** Eligible delivery / miscCharges (incl. GST share). */
  deliveryBase: number
}

/** Prorate a pre-GST component so the discount matches customer-facing GST-inclusive totals. */
export function componentInclGst(component: number, taxable: number, gst: number): number {
  const c = Number(component) || 0
  if (c <= 0) return 0
  const t = Number(taxable) || 0
  const g = Number(gst) || 0
  if (t <= 0) return Math.round(c)
  return Math.round(c + (c / t) * g)
}

export function computeDiscount(
  promo: Pick<PromoCode, 'kind' | 'value' | 'maxDiscount'>,
  cartTotalOrCtx: number | PromoDiscountContext,
): number {
  const ctx: PromoDiscountContext =
    typeof cartTotalOrCtx === 'number'
      ? { cartBase: cartTotalOrCtx, makingBase: 0, deliveryBase: 0 }
      : cartTotalOrCtx
  const cartBase = Math.max(0, Math.round(ctx.cartBase))
  const makingBase = Math.max(0, Math.round(ctx.makingBase))
  const deliveryBase = Math.max(0, Math.round(ctx.deliveryBase))
  const value = Number(promo.value)

  switch (promo.kind) {
    case 'PERCENT': {
      const raw = (cartBase * value) / 100
      const cap = promo.maxDiscount != null ? Number(promo.maxDiscount) : Infinity
      return Math.min(Math.round(raw), Math.round(cap), cartBase)
    }
    case 'FLAT':
      return Math.min(Math.round(value), cartBase)
    case 'FREE_DELIVERY':
      return Math.min(deliveryBase, cartBase)
    case 'MAKING_PERCENT': {
      const raw = (makingBase * value) / 100
      const cap = promo.maxDiscount != null ? Number(promo.maxDiscount) : Infinity
      return Math.min(Math.round(raw), Math.round(cap), makingBase, cartBase)
    }
    case 'MAKING_FLAT':
      return Math.min(Math.round(value), makingBase, cartBase)
    default:
      return 0
  }
}

/** True if the user has at least one successfully paid order. */
export async function userHasPriorPaidOrder(userId: string): Promise<boolean> {
  const prior = await prisma.order.findFirst({
    where: {
      userId,
      payment: {
        status: { in: ['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
      },
    },
    select: { id: true },
  })
  return prior != null
}

export async function validatePromo(
  codeRaw: string,
  userId: string,
  cartTotal: number,
): Promise<PromoResult> {
  const code = codeRaw.trim().toUpperCase()
  if (!code) return { ok: false, reason: 'Enter a promo code' }

  const promo = await prisma.promoCode.findUnique({ where: { code } })
  if (!promo || !promo.active) return { ok: false, reason: 'Invalid promo code' }

  const now = new Date()
  if (promo.startsAt && now < promo.startsAt) return { ok: false, reason: 'This code is not active yet' }
  if (promo.endsAt && now > promo.endsAt) return { ok: false, reason: 'This code has expired' }
  if (cartTotal < Number(promo.minOrderValue)) {
    return {
      ok: false,
      reason: `Minimum order value ₹${Number(promo.minOrderValue).toLocaleString('en-IN')}`,
    }
  }

  if (promo.firstOrderOnly && (await userHasPriorPaidOrder(userId))) {
    return { ok: false, reason: 'This code is only for your first order' }
  }

  const [totalUses, userUses] = await Promise.all([
    prisma.promoRedemption.count({ where: { promoCodeId: promo.id } }),
    prisma.promoRedemption.count({ where: { promoCodeId: promo.id, userId } }),
  ])
  if (promo.maxRedemptions != null && totalUses >= promo.maxRedemptions) {
    return { ok: false, reason: 'This code has been fully redeemed' }
  }
  if (userUses >= promo.maxPerUser) {
    return { ok: false, reason: 'You have already used this code' }
  }

  // Legacy empty-cart path: only PERCENT/FLAT against cartTotal.
  if (promo.kind === 'FREE_DELIVERY' || promo.kind === 'MAKING_PERCENT' || promo.kind === 'MAKING_FLAT') {
    return {
      ok: false,
      reason: 'Add items to your cart to apply this code',
    }
  }

  const discount = computeDiscount(promo, cartTotal)
  if (discount <= 0) return { ok: false, reason: 'This code does not apply to your cart' }
  return { ok: true, promo, discount }
}
