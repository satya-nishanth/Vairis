/**
 * Display helpers for automatic discount badges (PLP/PDP).
 * Authoritative amounts are always recomputed at cart/checkout.
 */

import type { Category } from '@prisma/client'
import {
  lineMatchesScope,
  loadActiveAutomaticDiscounts,
  type ScopedAuto,
} from '@/lib/discounts'
import { prisma } from '@/lib/prisma'

export type AutoDiscountLookup = {
  rules: ScopedAuto[]
  membership: Map<string, { collectionIds: string[]; storeCategoryIds: string[] }>
}

export type AutoDiscountInfo = {
  percent: number
  /** Customer-facing reason; null when unset (PDP can fall back to % only). */
  displayName: string | null
}

export async function buildAutoDiscountLookup(
  productIds: string[],
): Promise<AutoDiscountLookup> {
  const unique = [...new Set(productIds.filter(Boolean))]
  const [rules, cols, cats] = await Promise.all([
    loadActiveAutomaticDiscounts(),
    unique.length
      ? prisma.collectionProduct.findMany({
          where: { productId: { in: unique } },
          select: { productId: true, collectionId: true },
        })
      : Promise.resolve([]),
    unique.length
      ? prisma.storeCategoryProduct.findMany({
          where: { productId: { in: unique } },
          select: { productId: true, categoryId: true },
        })
      : Promise.resolve([]),
  ])

  const membership = new Map<string, { collectionIds: string[]; storeCategoryIds: string[] }>()
  for (const id of unique) membership.set(id, { collectionIds: [], storeCategoryIds: [] })
  for (const row of cols) membership.get(row.productId)?.collectionIds.push(row.collectionId)
  for (const row of cats) membership.get(row.productId)?.storeCategoryIds.push(row.categoryId)

  return { rules, membership }
}

function bestMatchingRule(
  lookup: AutoDiscountLookup,
  product: { id: string; category: Category },
): ScopedAuto | null {
  if (lookup.rules.length === 0) return null
  const mem = lookup.membership.get(product.id) ?? {
    collectionIds: [],
    storeCategoryIds: [],
  }
  const line = {
    productId: product.id,
    category: product.category,
    collectionIds: mem.collectionIds,
    storeCategoryIds: mem.storeCategoryIds,
  }
  const matches = lookup.rules.filter((r) =>
    lineMatchesScope(line, {
      productIds: r.products.map((p) => p.productId),
      collectionIds: r.collections.map((c) => c.collectionId),
      storeCategoryIds: r.storeCategories.map((s) => s.storeCategoryId),
      categories: r.categories.map((c) => c.category),
    }),
  )
  if (matches.length === 0) return null
  matches.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return Number(b.percent) - Number(a.percent)
  })
  return matches[0] ?? null
}

export function autoDiscountPercentForProduct(
  lookup: AutoDiscountLookup,
  product: { id: string; category: Category },
): number | null {
  const rule = bestMatchingRule(lookup, product)
  if (!rule) return null
  const pct = Number(rule.percent)
  return pct > 0 ? pct : null
}

export function autoDiscountInfoForProduct(
  lookup: AutoDiscountLookup,
  product: { id: string; category: Category },
): AutoDiscountInfo | null {
  const rule = bestMatchingRule(lookup, product)
  if (!rule) return null
  const pct = Number(rule.percent)
  if (!(pct > 0)) return null
  const display =
    typeof rule.displayName === 'string' && rule.displayName.trim()
      ? rule.displayName.trim()
      : null
  return { percent: pct, displayName: display }
}

export function saleBadgeLabel(percent: number): string {
  return `${Math.round(percent)}% off`
}

/** Batch lookup: productId → active auto discount info. */
export async function autoDiscountInfoForProducts(
  products: { id: string; category: Category }[],
): Promise<Map<string, AutoDiscountInfo>> {
  const lookup = await buildAutoDiscountLookup(products.map((p) => p.id))
  const map = new Map<string, AutoDiscountInfo>()
  for (const p of products) {
    const info = autoDiscountInfoForProduct(lookup, p)
    if (info) map.set(p.id, info)
  }
  return map
}

/** @deprecated Prefer autoDiscountInfoForProducts — kept for call-site compatibility. */
export async function autoDiscountPercentsForProducts(
  products: { id: string; category: Category }[],
): Promise<Map<string, number>> {
  const info = await autoDiscountInfoForProducts(products)
  const map = new Map<string, number>()
  for (const [id, v] of info) map.set(id, v.percent)
  return map
}
