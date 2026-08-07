import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { PromoCode } from '@prisma/client'

const num = z.union([z.string(), z.number()]).transform(Number)

/** Admin create/update payload (also used by the admin promos UI). */
export const promoSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Code must be at least 3 characters')
    .max(40)
    .transform((s) => s.toUpperCase().replace(/\s+/g, '')),
  description: z.string().trim().max(200).optional().nullable(),
  kind: z.enum(['PERCENT', 'FLAT']),
  value: num.refine((n) => n > 0, 'Value must be positive'),
  minOrderValue: num.refine((n) => n >= 0).default(0),
  maxDiscount: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  maxRedemptions: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
  maxPerUser: num.refine((n) => n >= 1).default(1),
  active: z.boolean().default(true),
})

/**
 * Promo code validation + discount math — single source of truth used by
 * the cart preview endpoint and the checkout order-create path (both
 * server-side; client-supplied discounts are never trusted).
 */

export type PromoResult =
  | { ok: true; promo: PromoCode; discount: number }
  | { ok: false; reason: string }

export function computeDiscount(promo: PromoCode, cartTotal: number): number {
  const value = Number(promo.value)
  if (promo.kind === 'PERCENT') {
    const raw = (cartTotal * value) / 100
    const cap = promo.maxDiscount != null ? Number(promo.maxDiscount) : Infinity
    return Math.min(Math.round(raw), Math.round(cap), cartTotal)
  }
  return Math.min(Math.round(value), cartTotal)
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

  const discount = computeDiscount(promo, cartTotal)
  if (discount <= 0) return { ok: false, reason: 'This code does not apply to your cart' }
  return { ok: true, promo, discount }
}
