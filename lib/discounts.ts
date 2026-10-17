/**
 * Discount + coupon engine — eligibility, auto-then-coupon stacking,
 * and per-line post-GST allocations. Never trust client-supplied amounts.
 *
 * Timing: both reductions apply after GST-inclusive line totals
 * (gold / wastage / making / stones / taxable / GST formula unchanged).
 */

import type { Category, PromoCode, PromoKind } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeDiscount, componentInclGst, userHasPriorPaidOrder } from '@/lib/promo'
import type { OrderItemPriceSnapshot } from '@/lib/pricing'

export type DiscountScopeIds = {
  productIds: string[]
  collectionIds: string[]
  storeCategoryIds: string[]
  categories: Category[]
}

export type DiscountLineInput = {
  key: string
  variantId: string
  productId: string
  category: Category
  collectionIds: string[]
  storeCategoryIds: string[]
  quantity: number
  /** GST-inclusive unit total (priceBreakdown.total). */
  unitTotal: number
  /** GST-inclusive making (₹) for MAKING_* coupons. */
  unitMakingInclGst?: number
  /** GST-inclusive delivery / miscCharges (₹) for FREE_DELIVERY. */
  unitDeliveryInclGst?: number
}

/** Build discount line bases from a priced snapshot. */
export function discountBasesFromSnapshot(snapshot: {
  making: number
  miscCharges: number
  deliveryCharges?: number
  taxable: number
  gst: number
  total: number
}): Pick<DiscountLineInput, 'unitTotal' | 'unitMakingInclGst' | 'unitDeliveryInclGst'> {
  // Prefer first-class delivery; legacy snapshots used miscCharges as delivery/hallmark.
  const deliveryBase =
    snapshot.deliveryCharges != null && snapshot.deliveryCharges > 0
      ? snapshot.deliveryCharges
      : snapshot.miscCharges
  return {
    unitTotal: Math.round(snapshot.total),
    unitMakingInclGst: componentInclGst(snapshot.making, snapshot.taxable, snapshot.gst),
    unitDeliveryInclGst: componentInclGst(deliveryBase, snapshot.taxable, snapshot.gst),
  }
}

export type AutomaticLeg = {
  id: string
  name: string
  amount: number
  percent: number
}

export type CouponLeg = {
  id: string
  code: string
  kind: PromoKind
  amount: number
  percent?: number
}

export type OrderDiscountBreakdown = {
  automatic: AutomaticLeg | null
  coupon: CouponLeg | null
}

export type LineDiscountAllocation = {
  key: string
  variantId: string
  /** Per-unit auto discount (₹). */
  autoDiscount: number
  autoDiscountPercent?: number
  autoDiscountLabel?: string
  /** Per-unit coupon discount (₹). */
  couponDiscount: number
  couponDiscountPercent?: number
  couponCode?: string
  couponKind?: PromoKind
  /** Per-unit payable after both. */
  payable: number
  /** Line totals (qty × unit). */
  lineAuto: number
  lineCoupon: number
}

export type DiscountComputation = {
  automatic: AutomaticLeg | null
  coupon: CouponLeg | null
  /** Sum of auto + coupon across all lines. */
  discountAmount: number
  allocations: LineDiscountAllocation[]
  breakdown: OrderDiscountBreakdown
}

export type ScopedPromo = PromoCode & {
  products: { productId: string }[]
  collections: { collectionId: string }[]
  storeCategories: { storeCategoryId: string }[]
  categories: { category: Category }[]
}

export type ScopedAuto = {
  id: string
  name: string
  displayName?: string | null
  active: boolean
  percent: { toString(): string } | number
  maxDiscount: { toString(): string } | number | null
  startsAt: Date | null
  endsAt: Date | null
  priority: number
  products: { productId: string }[]
  collections: { collectionId: string }[]
  storeCategories: { storeCategoryId: string }[]
  categories: { category: Category }[]
}

const PROMO_SCOPE_INCLUDE = {
  products: { select: { productId: true } },
  collections: { select: { collectionId: true } },
  storeCategories: { select: { storeCategoryId: true } },
  categories: { select: { category: true } },
} as const

const AUTO_SCOPE_INCLUDE = PROMO_SCOPE_INCLUDE

function scopeFromJoins(rule: {
  products: { productId: string }[]
  collections: { collectionId: string }[]
  storeCategories: { storeCategoryId: string }[]
  categories: { category: Category }[]
}): DiscountScopeIds {
  return {
    productIds: rule.products.map((p) => p.productId),
    collectionIds: rule.collections.map((c) => c.collectionId),
    storeCategoryIds: rule.storeCategories.map((s) => s.storeCategoryId),
    categories: rule.categories.map((c) => c.category),
  }
}

/** Empty scope = all products. */
export function isScopeEmpty(scope: DiscountScopeIds): boolean {
  return (
    scope.productIds.length === 0 &&
    scope.collectionIds.length === 0 &&
    scope.storeCategoryIds.length === 0 &&
    scope.categories.length === 0
  )
}

export function lineMatchesScope(
  line: Pick<DiscountLineInput, 'productId' | 'category' | 'collectionIds' | 'storeCategoryIds'>,
  scope: DiscountScopeIds,
): boolean {
  if (isScopeEmpty(scope)) return true
  if (scope.productIds.includes(line.productId)) return true
  if (scope.categories.includes(line.category)) return true
  if (line.collectionIds.some((id) => scope.collectionIds.includes(id))) return true
  if (line.storeCategoryIds.some((id) => scope.storeCategoryIds.includes(id))) return true
  return false
}

function inWindow(startsAt: Date | null, endsAt: Date | null, now: Date): boolean {
  if (startsAt && now < startsAt) return false
  if (endsAt && now > endsAt) return false
  return true
}

function pickBestAuto(
  line: DiscountLineInput,
  rules: ScopedAuto[],
  now: Date,
): ScopedAuto | null {
  const matches = rules.filter((r) => {
    if (!r.active) return false
    if (!inWindow(r.startsAt, r.endsAt, now)) return false
    return lineMatchesScope(line, scopeFromJoins(r))
  })
  if (matches.length === 0) return null
  matches.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return Number(b.percent) - Number(a.percent)
  })
  return matches[0] ?? null
}

/** Distribute `total` across weights; last bucket absorbs rounding residue. */
function allocateRounded(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0)
  if (total <= 0 || sum <= 0) return weights.map(() => 0)
  const out: number[] = []
  let allocated = 0
  for (let i = 0; i < weights.length; i++) {
    if (i === weights.length - 1) {
      out.push(Math.max(0, total - allocated))
    } else {
      const part = Math.round((total * weights[i]) / sum)
      out.push(part)
      allocated += part
    }
  }
  return out
}

/**
 * Pure computation given loaded rules + optional validated coupon.
 * `coupon` must already pass redemption / schedule checks when provided.
 */
export function computeStackedDiscounts(
  lines: DiscountLineInput[],
  autoRules: ScopedAuto[],
  coupon: ScopedPromo | null,
  now: Date = new Date(),
): DiscountComputation {
  if (lines.length === 0) {
    return {
      automatic: null,
      coupon: null,
      discountAmount: 0,
      allocations: [],
      breakdown: { automatic: null, coupon: null },
    }
  }

  type Working = {
    line: DiscountLineInput
    lineTotal: number
    autoRule: ScopedAuto | null
    lineAuto: number
    afterAuto: number
    couponEligible: boolean
    lineCoupon: number
  }

  const working: Working[] = lines.map((line) => {
    const lineTotal = Math.round(line.unitTotal) * Math.max(1, line.quantity)
    const autoRule = pickBestAuto(line, autoRules, now)
    return {
      line,
      lineTotal,
      autoRule,
      lineAuto: 0,
      afterAuto: lineTotal,
      couponEligible: false,
      lineCoupon: 0,
    }
  })

  // Auto % per line (before global maxDiscount scale)
  for (const w of working) {
    if (!w.autoRule) continue
    const pct = Number(w.autoRule.percent)
    if (!(pct > 0)) continue
    w.lineAuto = Math.min(w.lineTotal, Math.round((w.lineTotal * pct) / 100))
  }

  // Cap by each rule's maxDiscount (scale lines that share that rule)
  const byRule = new Map<string, Working[]>()
  for (const w of working) {
    if (!w.autoRule || w.lineAuto <= 0) continue
    const list = byRule.get(w.autoRule.id) ?? []
    list.push(w)
    byRule.set(w.autoRule.id, list)
  }
  for (const [, group] of byRule) {
    const rule = group[0]?.autoRule
    if (!rule || rule.maxDiscount == null) continue
    const cap = Math.round(Number(rule.maxDiscount))
    if (!(cap >= 0)) continue
    const rawSum = group.reduce((s, w) => s + w.lineAuto, 0)
    if (rawSum <= cap) continue
    const scaled = allocateRounded(
      cap,
      group.map((w) => w.lineAuto),
    )
    group.forEach((w, i) => {
      w.lineAuto = scaled[i] ?? 0
    })
  }

  for (const w of working) {
    w.afterAuto = Math.max(0, w.lineTotal - w.lineAuto)
  }

  // Coupon on remaining eligible bases
  let couponAmount = 0
  let couponMeta: CouponLeg | null = null
  if (coupon && coupon.active && inWindow(coupon.startsAt, coupon.endsAt, now)) {
    const scope = scopeFromJoins(coupon)
    for (const w of working) {
      w.couponEligible = lineMatchesScope(w.line, scope)
    }
    const eligible = working.filter((w) => w.couponEligible)
    const eligibleBase = eligible.reduce((s, w) => s + w.afterAuto, 0)
    const makingBase = eligible.reduce(
      (s, w) => s + Math.round(w.line.unitMakingInclGst ?? 0) * Math.max(1, w.line.quantity),
      0,
    )
    const deliveryBase = eligible.reduce(
      (s, w) => s + Math.round(w.line.unitDeliveryInclGst ?? 0) * Math.max(1, w.line.quantity),
      0,
    )
    if (eligibleBase >= Number(coupon.minOrderValue)) {
      couponAmount = computeDiscount(coupon, {
        cartBase: eligibleBase,
        makingBase,
        deliveryBase,
      })
      if (couponAmount > 0) {
        const targets = eligible.filter((w) => w.afterAuto > 0)
        const weightFor = (w: Working): number => {
          const qty = Math.max(1, w.line.quantity)
          if (coupon.kind === 'FREE_DELIVERY') {
            return Math.round(w.line.unitDeliveryInclGst ?? 0) * qty
          }
          if (coupon.kind === 'MAKING_PERCENT' || coupon.kind === 'MAKING_FLAT') {
            return Math.round(w.line.unitMakingInclGst ?? 0) * qty
          }
          return w.afterAuto
        }
        const weights = targets.map(weightFor)
        const weightSum = weights.reduce((s, w) => s + w, 0)
        const parts = allocateRounded(
          couponAmount,
          weightSum > 0 ? weights : targets.map((w) => w.afterAuto),
        )
        targets.forEach((w, i) => {
          w.lineCoupon = Math.min(w.afterAuto, parts[i] ?? 0)
        })
        couponAmount = working.reduce((s, w) => s + w.lineCoupon, 0)
        couponMeta = {
          id: coupon.id,
          code: coupon.code,
          kind: coupon.kind,
          amount: couponAmount,
          percent:
            coupon.kind === 'PERCENT' || coupon.kind === 'MAKING_PERCENT'
              ? Number(coupon.value)
              : undefined,
        }
      }
    }
  }

  // Order-level automatic leg: if multiple rules applied, use the dominant
  // by amount; still stamp per-line labels from each line's rule.
  const autoById = new Map<string, { id: string; name: string; percent: number; amount: number }>()
  for (const w of working) {
    if (!w.autoRule || w.lineAuto <= 0) continue
    const cur = autoById.get(w.autoRule.id) ?? {
      id: w.autoRule.id,
      name: w.autoRule.displayName?.trim() || w.autoRule.name,
      percent: Number(w.autoRule.percent),
      amount: 0,
    }
    cur.amount += w.lineAuto
    autoById.set(w.autoRule.id, cur)
  }
  let automatic: AutomaticLeg | null = null
  const autoTotal = [...autoById.values()].reduce((s, a) => s + a.amount, 0)
  if (autoTotal > 0) {
    const dominant = [...autoById.values()].sort((a, b) => b.amount - a.amount)[0]!
    automatic = {
      id: dominant.id,
      name:
        autoById.size === 1
          ? (dominant.name)
          : 'Automatic discount',
      amount: autoTotal,
      percent: dominant.percent,
    }
  }

  const allocations: LineDiscountAllocation[] = working.map((w) => {
    const qty = Math.max(1, w.line.quantity)
    const autoUnit = Math.round(w.lineAuto / qty)
    // Put residue on unit so qty * unit ≈ line (last unit absorbs via payable math on total)
    const couponUnit = Math.round(w.lineCoupon / qty)
    // Prefer exact unit fields that reconstruct line when possible
    let unitAuto = autoUnit
    let unitCoupon = couponUnit
    if (qty === 1) {
      unitAuto = w.lineAuto
      unitCoupon = w.lineCoupon
    } else {
      // Keep unit × qty close; store exact line on payable from unit total
      unitAuto = Math.floor(w.lineAuto / qty)
      unitCoupon = Math.floor(w.lineCoupon / qty)
      // Bump first unit conceptually — snapshot is one unit; finance uses total pre-discount.
      // Use rounded per-unit so display is clean; line totals use lineAuto/lineCoupon.
      unitAuto = Math.round(w.lineAuto / qty)
      unitCoupon = Math.round(w.lineCoupon / qty)
    }
    const unitTotal = Math.round(w.line.unitTotal)
    const payable = Math.max(0, unitTotal - unitAuto - unitCoupon)
    return {
      key: w.line.key,
      variantId: w.line.variantId,
      autoDiscount: unitAuto,
      autoDiscountPercent: w.autoRule && w.lineAuto > 0 ? Number(w.autoRule.percent) : undefined,
      autoDiscountLabel:
        w.autoRule && w.lineAuto > 0
          ? (w.autoRule.displayName?.trim() || w.autoRule.name)
          : undefined,
      couponDiscount: unitCoupon,
      couponDiscountPercent:
        (couponMeta?.kind === 'PERCENT' || couponMeta?.kind === 'MAKING_PERCENT') &&
        w.lineCoupon > 0
          ? couponMeta.percent
          : undefined,
      couponCode: w.lineCoupon > 0 ? couponMeta?.code : undefined,
      couponKind: w.lineCoupon > 0 ? couponMeta?.kind : undefined,
      payable,
      lineAuto: w.lineAuto,
      lineCoupon: w.lineCoupon,
    }
  })

  // Prefer exact line sums for order.discountAmount (avoids unit rounding drift)
  const discountAmount =
    working.reduce((s, w) => s + w.lineAuto + w.lineCoupon, 0)

  if (automatic) automatic.amount = working.reduce((s, w) => s + w.lineAuto, 0)
  if (couponMeta) couponMeta.amount = working.reduce((s, w) => s + w.lineCoupon, 0)

  return {
    automatic,
    coupon: couponMeta,
    discountAmount,
    allocations,
    breakdown: { automatic, coupon: couponMeta },
  }
}

/** Stamp separate auto/coupon fields onto a unit price snapshot. */
export function applyDiscountToSnapshot(
  snapshot: OrderItemPriceSnapshot,
  alloc: Pick<
    LineDiscountAllocation,
    | 'autoDiscount'
    | 'autoDiscountPercent'
    | 'autoDiscountLabel'
    | 'couponDiscount'
    | 'couponDiscountPercent'
    | 'couponCode'
    | 'couponKind'
    | 'payable'
  >,
): OrderItemPriceSnapshot {
  return {
    ...snapshot,
    autoDiscount: alloc.autoDiscount,
    autoDiscountPercent: alloc.autoDiscountPercent,
    autoDiscountLabel: alloc.autoDiscountLabel,
    couponDiscount: alloc.couponDiscount,
    couponDiscountPercent: alloc.couponDiscountPercent,
    couponCode: alloc.couponCode,
    couponKind: alloc.couponKind,
    payable: alloc.payable,
  }
}

export async function loadActiveAutomaticDiscounts(now: Date = new Date()): Promise<ScopedAuto[]> {
  const rules = await prisma.automaticDiscount.findMany({
    where: {
      active: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    include: AUTO_SCOPE_INCLUDE,
    orderBy: [{ priority: 'desc' }, { percent: 'desc' }],
  })
  return rules
}

export async function loadPromoWithScope(codeRaw: string): Promise<ScopedPromo | null> {
  const code = codeRaw.trim().toUpperCase()
  if (!code) return null
  return prisma.promoCode.findUnique({
    where: { code },
    include: PROMO_SCOPE_INCLUDE,
  })
}

export type ValidateCouponResult =
  | { ok: true; promo: ScopedPromo }
  | { ok: false; reason: string }

/** Redemption + schedule checks only (discount math runs in computeStackedDiscounts). */
export async function validateCouponForUser(
  codeRaw: string,
  userId: string,
): Promise<ValidateCouponResult> {
  const promo = await loadPromoWithScope(codeRaw)
  if (!promo || !promo.active) return { ok: false, reason: 'Invalid promo code' }

  const now = new Date()
  if (promo.startsAt && now < promo.startsAt) return { ok: false, reason: 'This code is not active yet' }
  if (promo.endsAt && now > promo.endsAt) return { ok: false, reason: 'This code has expired' }

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
  return { ok: true, promo }
}

/** Load membership ids for cart product ids (collections + store categories). */
export async function loadProductScopeMembership(productIds: string[]): Promise<
  Map<string, { collectionIds: string[]; storeCategoryIds: string[] }>
> {
  const unique = [...new Set(productIds.filter(Boolean))]
  const map = new Map<string, { collectionIds: string[]; storeCategoryIds: string[] }>()
  for (const id of unique) map.set(id, { collectionIds: [], storeCategoryIds: [] })
  if (unique.length === 0) return map

  const [cols, cats] = await Promise.all([
    prisma.collectionProduct.findMany({
      where: { productId: { in: unique } },
      select: { productId: true, collectionId: true },
    }),
    prisma.storeCategoryProduct.findMany({
      where: { productId: { in: unique } },
      select: { productId: true, categoryId: true },
    }),
  ])
  for (const row of cols) {
    map.get(row.productId)?.collectionIds.push(row.collectionId)
  }
  for (const row of cats) {
    map.get(row.productId)?.storeCategoryIds.push(row.categoryId)
  }
  return map
}

/**
 * Full cart preview / checkout: load auto rules + optional coupon, compute stack.
 * Returns ok:false when a code was supplied but is invalid or yields ₹0 on eligible lines.
 */
export async function previewCartDiscounts(args: {
  lines: DiscountLineInput[]
  userId: string
  promoCode?: string | null
}): Promise<
  | { ok: true; result: DiscountComputation }
  | { ok: false; reason: string }
> {
  const now = new Date()
  const autoRules = await loadActiveAutomaticDiscounts(now)

  let coupon: ScopedPromo | null = null
  const code = args.promoCode?.trim()
  if (code) {
    const validated = await validateCouponForUser(code, args.userId)
    if (!validated.ok) return validated
    coupon = validated.promo
  }

  const result = computeStackedDiscounts(args.lines, autoRules, coupon, now)

  if (code && (!result.coupon || result.coupon.amount <= 0)) {
    const eligibleBase = args.lines.reduce((s, l) => s + Math.round(l.unitTotal) * l.quantity, 0)
    if (coupon && eligibleBase < Number(coupon.minOrderValue)) {
      return {
        ok: false,
        reason: `Minimum order value ₹${Number(coupon.minOrderValue).toLocaleString('en-IN')}`,
      }
    }
    return { ok: false, reason: 'This code does not apply to your cart' }
  }

  return { ok: true, result }
}

export function isOrderDiscountBreakdown(v: unknown): v is OrderDiscountBreakdown {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return 'automatic' in o && 'coupon' in o
}
