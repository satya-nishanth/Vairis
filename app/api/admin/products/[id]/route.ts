import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { assignProductToStoreCategory, toPrismaProductCategory } from '@/lib/store-categories'
import { setProductPriority } from '@/lib/product-priorities'
import {
  getAllCategoryFilters,
  getProductLinkedLabels,
  setProductLabels,
} from '@/lib/category-filters'
import {
  flattenPieceVariants,
  normalizePiecesFromBody,
  syncProductPieces,
} from '@/lib/admin-product-pieces'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

const patchVariantSchema = z.object({
  metalType: z.enum(['GOLD_18K', 'GOLD_14K', 'ROSE_GOLD'] as const),
  weightGrams: z
    .union([z.string(), z.number()])
    .transform((v) => (v === '' || v === null || v === undefined ? 0 : Number(v)))
    .refine((n) => !Number.isNaN(n) && n >= 0, 'Weight cannot be negative'),
  makingChargePerGram: z
    .union([z.string(), z.number()])
    .transform((v) => (v === '' || v === null || v === undefined ? 0 : Number(v)))
    .refine((n) => !Number.isNaN(n) && n >= 0, 'Making charge cannot be negative'),
  flatMakingCharge: z.union([z.string(), z.number()]).transform(Number).default(0),
  stoneCharges: z.union([z.string(), z.number()]).transform(Number).default(0),
  miscCharges: z.union([z.string(), z.number()]).transform(Number).default(45),
  stock: z.union([z.string(), z.number()]).transform(Number).default(0),
  sku: z.string().min(1, 'SKU is required'),
  size: z.string().optional(),
})

const patchStoneSchema = z.object({
  diamondRateId: z.string().min(1),
  caratWeight: z
    .union([z.string(), z.number()])
    .transform(Number)
    .refine((n) => !Number.isNaN(n) && n > 0, 'Carat weight must be positive'),
  count: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v))),
  label: z.string().optional().nullable(),
  ratePerCarat: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === '') return null
      const n = Number(v)
      return Number.isNaN(n) ? null : n
    }),
  ratePerCaratExchange: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === '') return null
      const n = Number(v)
      return Number.isNaN(n) ? null : n
    }),
})

const vaPct = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  })
  .refine((n) => n === null || (n >= 0 && n <= 100), 'Wastage % must be between 0 and 100')

const vaLabelSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null
    const t = String(v).trim()
    return t || null
  })

const patchPieceSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().default('Main'),
  vaGoldPct: vaPct,
  vaLabel: vaLabelSchema,
  variants: z.array(patchVariantSchema).default([]),
  stones: z.array(patchStoneSchema).default([]),
})

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().min(1).optional(),
  itemCode: z.string().nullable().optional(),
  designStyle: z.string().nullable().optional(),
  totalLengthMm: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v ? Number(v) : null)),
  motifSizeMm: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v ? Number(v) : null)),
  thicknessMm: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v ? Number(v) : null)),
  stoneType: z.string().nullable().optional(),
  stoneShape: z.string().nullable().optional(),
  stoneDimMm: z.string().nullable().optional(),
  gemCount: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v ? Number(v) : null)),
  caratWeight: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v ? Number(v) : null)),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  comingSoon: z.boolean().optional(),
  status: z.enum(['DRAFT', 'AI_DRAFT', 'LIVE']).optional(),
  priority: z.coerce.number().int().optional(),
  priceVisibility: z.enum(['INHERIT', 'SHOW', 'HIDE']).optional(),
  vaGoldPct: vaPct,
  vaLabel: vaLabelSchema,
  pieces: z.array(patchPieceSchema).optional(),
  stones: z.array(patchStoneSchema).optional(),
  variants: z.array(patchVariantSchema).optional(),
  labels: z.array(z.string()).optional(),
})

export async function GET(_: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params
  const [product, allFilters] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        pieces: {
          orderBy: { sortOrder: 'asc' },
          include: {
            variants: true,
            stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
        variants: true,
        stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
      },
    }),
    getAllCategoryFilters(),
  ])
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const labels = getProductLinkedLabels(product, allFilters)
  return NextResponse.json({ ...product, labels })
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    const first =
      parsed.error.issues[0]?.message ??
      Object.values(flat.fieldErrors).flat()[0] ??
      'Validation failed'
    return NextResponse.json(
      { error: first, fields: flat.fieldErrors, formErrors: flat.formErrors },
      { status: 400 },
    )
  }

  const data = parsed.data

  try {
    const product = await prisma.$transaction(async (tx) => {
      // A product being made (or kept) LIVE must end up with ≥1 variant, and
      // (unless coming-soon) at least one with weight > 0 — a weight-0
      // variant silently produces no price at all on the storefront
      // (calculatePrice requires weight > 0), so the PDP just shows
      // "Enquire on WhatsApp" with no indication anything is wrong.
      const existing =
        data.status === undefined || data.comingSoon === undefined
          ? await tx.product.findUniqueOrThrow({ where: { id }, select: { status: true, comingSoon: true } })
          : null
      const targetStatus = data.status ?? existing!.status
      const targetComingSoon = data.comingSoon ?? existing!.comingSoon
      const syncingPieces =
        data.pieces !== undefined || data.variants !== undefined || data.stones !== undefined

      if (targetStatus === 'LIVE') {
        let variantWeights: number[]
        if (syncingPieces) {
          const pieces = normalizePiecesFromBody({
            pieces: data.pieces as any,
            variants: data.variants as any,
            stones: data.stones as any,
            vaGoldPct: data.vaGoldPct,
            vaLabel: data.vaLabel,
          })
          variantWeights = flattenPieceVariants(pieces).map((v) => Number(v.weightGrams))
        } else {
          variantWeights = (
            await tx.productVariant.findMany({ where: { productId: id }, select: { weightGrams: true } })
          ).map((v) => Number(v.weightGrams))
        }
        if (variantWeights.length < 1) {
          throw new Error('A live product needs at least one variant')
        }
        if (!targetComingSoon && !variantWeights.some((w) => w > 0)) {
          throw new Error(
            'A live product needs at least one variant with a gold weight greater than 0 — otherwise no price ever shows on the storefront',
          )
        }
      }

      if (syncingPieces) {
        const pieces = normalizePiecesFromBody({
          pieces: data.pieces as any,
          variants: data.variants as any,
          stones: data.stones as any,
          vaGoldPct: data.vaGoldPct,
          vaLabel: data.vaLabel,
        })
        await syncProductPieces(tx, id, pieces)
      }

      const resolvedCategory = data.category !== undefined ? toPrismaProductCategory(data.category) : undefined

      return tx.product.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(resolvedCategory ? { category: resolvedCategory } : {}),
          ...(data.itemCode !== undefined && { itemCode: data.itemCode || null }),
          ...(data.designStyle !== undefined && { designStyle: data.designStyle || null }),
          ...(data.totalLengthMm !== undefined && { totalLengthMm: data.totalLengthMm }),
          ...(data.motifSizeMm !== undefined && { motifSizeMm: data.motifSizeMm }),
          ...(data.thicknessMm !== undefined && { thicknessMm: data.thicknessMm }),
          ...(data.stoneType !== undefined && { stoneType: data.stoneType || null }),
          ...(data.stoneShape !== undefined && { stoneShape: data.stoneShape || null }),
          ...(data.stoneDimMm !== undefined && { stoneDimMm: data.stoneDimMm || null }),
          ...(data.gemCount !== undefined && { gemCount: data.gemCount }),
          ...(data.caratWeight !== undefined && { caratWeight: data.caratWeight }),
          ...(data.images !== undefined && { images: data.images }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.comingSoon !== undefined && { comingSoon: data.comingSoon }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.priority !== undefined && { priority: data.priority }),
          ...(data.priceVisibility !== undefined && { priceVisibility: data.priceVisibility }),
          ...(!syncingPieces && data.vaGoldPct !== undefined && { vaGoldPct: data.vaGoldPct }),
          ...(!syncingPieces && data.vaLabel !== undefined && { vaLabel: data.vaLabel }),
        },
        include: {
          pieces: {
            orderBy: { sortOrder: 'asc' },
            include: { variants: true, stones: { include: { diamondRate: true } } },
          },
          variants: true,
          stones: { include: { diamondRate: true } },
        },
      })
    })

    if (data.category !== undefined) {
      try {
        const catSlug = data.category.toLowerCase().replace(/_/g, '-')
        await assignProductToStoreCategory(catSlug, id)
      } catch (err) {
        console.warn('[api/admin/products/[id]] failed linking to store category:', err)
      }
    }

    if (data.priority !== undefined) {
      setProductPriority(id, data.priority)
    }

    let finalLabels: string[] | undefined
    if (data.labels !== undefined) {
      try {
        const catSlug = (data.category ?? product.category).toLowerCase().replace(/_/g, '-')
        const savedConfig = await setProductLabels(id, catSlug, data.labels, product)
        finalLabels = getProductLinkedLabels(product, savedConfig)
      } catch (err) {
        console.warn('[api/admin/products/[id]] failed setting product labels:', err)
      }
    }

    return NextResponse.json({ ...product, ...(finalLabels !== undefined ? { labels: finalLabels } : {}) })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Cannot remove a variant')) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    if (err instanceof Error && err.message.startsWith('A live product needs')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return NextResponse.json(
          { error: `Duplicate value for unique field (${(err.meta?.target as string[] | undefined)?.join(', ') ?? 'unknown'})` },
          { status: 409 },
        )
      }
      if (err.code === 'P2003') {
        return NextResponse.json(
          { error: 'Update blocked by related records (cart/orders). Try again or change SKU carefully.' },
          { status: 409 },
        )
      }
      if (err.code === 'P2025') {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      // Missing enum value e.g. NECKLACES on older DBs
      if (err.message.includes('NECKLACES') || err.message.includes('invalid input value for enum')) {
        return NextResponse.json(
          { error: 'Database is missing the NECKLACES category. Run: ALTER TYPE "Category" ADD VALUE IF NOT EXISTS \'NECKLACES\';' },
          { status: 500 },
        )
      }
      console.error('[admin/products PATCH]', err.code, err.message)
      return NextResponse.json({ error: `Database error (${err.code})` }, { status: 500 })
    }
    console.error('[admin/products PATCH]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 },
    )
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params
  await prisma.product.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
