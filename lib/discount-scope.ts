import type { Category, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type ScopePayload = {
  productIds: string[]
  collectionIds: string[]
  storeCategoryIds: string[]
  categories: Category[]
}

export function normalizeScope(input: {
  productIds?: string[]
  collectionIds?: string[]
  storeCategoryIds?: string[]
  categories?: Category[]
}): ScopePayload {
  return {
    productIds: [...new Set(input.productIds ?? [])],
    collectionIds: [...new Set(input.collectionIds ?? [])],
    storeCategoryIds: [...new Set(input.storeCategoryIds ?? [])],
    categories: [...new Set(input.categories ?? [])],
  }
}

export async function replacePromoScopes(promoCodeId: string, scope: ScopePayload) {
  await prisma.$transaction([
    prisma.promoCodeProduct.deleteMany({ where: { promoCodeId } }),
    prisma.promoCodeCollection.deleteMany({ where: { promoCodeId } }),
    prisma.promoCodeStoreCategory.deleteMany({ where: { promoCodeId } }),
    prisma.promoCodeCategory.deleteMany({ where: { promoCodeId } }),
    ...(scope.productIds.length
      ? [
          prisma.promoCodeProduct.createMany({
            data: scope.productIds.map((productId) => ({ promoCodeId, productId })),
          }),
        ]
      : []),
    ...(scope.collectionIds.length
      ? [
          prisma.promoCodeCollection.createMany({
            data: scope.collectionIds.map((collectionId) => ({ promoCodeId, collectionId })),
          }),
        ]
      : []),
    ...(scope.storeCategoryIds.length
      ? [
          prisma.promoCodeStoreCategory.createMany({
            data: scope.storeCategoryIds.map((storeCategoryId) => ({
              promoCodeId,
              storeCategoryId,
            })),
          }),
        ]
      : []),
    ...(scope.categories.length
      ? [
          prisma.promoCodeCategory.createMany({
            data: scope.categories.map((category) => ({ promoCodeId, category })),
          }),
        ]
      : []),
  ])
}

export async function replaceAutomaticDiscountScopes(
  automaticDiscountId: string,
  scope: ScopePayload,
) {
  await prisma.$transaction([
    prisma.automaticDiscountProduct.deleteMany({ where: { automaticDiscountId } }),
    prisma.automaticDiscountCollection.deleteMany({ where: { automaticDiscountId } }),
    prisma.automaticDiscountStoreCategory.deleteMany({ where: { automaticDiscountId } }),
    prisma.automaticDiscountCategory.deleteMany({ where: { automaticDiscountId } }),
    ...(scope.productIds.length
      ? [
          prisma.automaticDiscountProduct.createMany({
            data: scope.productIds.map((productId) => ({ automaticDiscountId, productId })),
          }),
        ]
      : []),
    ...(scope.collectionIds.length
      ? [
          prisma.automaticDiscountCollection.createMany({
            data: scope.collectionIds.map((collectionId) => ({
              automaticDiscountId,
              collectionId,
            })),
          }),
        ]
      : []),
    ...(scope.storeCategoryIds.length
      ? [
          prisma.automaticDiscountStoreCategory.createMany({
            data: scope.storeCategoryIds.map((storeCategoryId) => ({
              automaticDiscountId,
              storeCategoryId,
            })),
          }),
        ]
      : []),
    ...(scope.categories.length
      ? [
          prisma.automaticDiscountCategory.createMany({
            data: scope.categories.map((category) => ({ automaticDiscountId, category })),
          }),
        ]
      : []),
  ])
}

export const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'RINGS', label: 'Rings' },
  { value: 'EARRINGS', label: 'Earrings' },
  { value: 'PENDANTS', label: 'Pendants' },
  { value: 'BRACELETS', label: 'Bracelets' },
  { value: 'NECKLACES', label: 'Necklaces' },
]

export type ScopeOption = { id: string; label: string }

export async function loadScopeOptions(): Promise<{
  products: ScopeOption[]
  collections: ScopeOption[]
  storeCategories: ScopeOption[]
}> {
  const [products, collections, storeCategories] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true, itemCode: true },
      orderBy: { name: 'asc' },
      take: 2000,
    }),
    prisma.collection.findMany({
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    }),
    prisma.storeCategory.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])
  return {
    products: products.map((p) => ({
      id: p.id,
      label: p.itemCode ? `${p.name} (${p.itemCode})` : p.name,
    })),
    collections: collections.map((c) => ({ id: c.id, label: c.title })),
    storeCategories: storeCategories.map((c) => ({ id: c.id, label: c.name })),
  }
}

/** Prisma include for reading scopes back onto list rows. */
export const promoScopeInclude = {
  products: { select: { productId: true } },
  collections: { select: { collectionId: true } },
  storeCategories: { select: { storeCategoryId: true } },
  categories: { select: { category: true } },
} satisfies Prisma.PromoCodeInclude

export const autoScopeInclude = {
  products: { select: { productId: true } },
  collections: { select: { collectionId: true } },
  storeCategories: { select: { storeCategoryId: true } },
  categories: { select: { category: true } },
} satisfies Prisma.AutomaticDiscountInclude
