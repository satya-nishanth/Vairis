import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { assignProductToStoreCategory, toPrismaProductCategory } from '@/lib/store-categories'
import { sortProductsByPriority, setProductPriority } from '@/lib/product-priorities'
import {
  createProductPieces,
  flattenPieceVariants,
  normalizePiecesFromBody,
} from '@/lib/admin-product-pieces'

export const dynamic = 'force-dynamic'

const variantSchema = z.object({
  metalType: z.enum(['GOLD_9K', 'GOLD_14K', 'GOLD_18K', 'GOLD_22K']),
  metalColor: z.enum(['YELLOW', 'WHITE', 'ROSE']).default('YELLOW'),
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

const stoneSchema = z.object({
  diamondRateId: z.string().min(1, 'Diamond type is required'),
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

const vaLabel = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null
    const t = String(v).trim()
    return t || null
  })

const pieceSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().default('Main'),
  vaGoldPct: vaPct,
  vaLabel,
  variants: z.array(variantSchema).default([]),
  stones: z.array(stoneSchema).default([]),
})

const productSchema = z
  .object({
    name: z.string().min(1, 'Product name is required'),
    description: z.string().default(''),
    category: z.string().min(1, 'Category is required'),
    itemCode: z.string().optional().nullable(),
    designStyle: z.string().optional().nullable(),
    totalLengthMm: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .transform((v) => (v ? Number(v) : null)),
    motifSizeMm: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .transform((v) => (v ? Number(v) : null)),
    thicknessMm: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .transform((v) => (v ? Number(v) : null)),
    stoneType: z.string().optional().nullable(),
    stoneShape: z.string().optional().nullable(),
    stoneDimMm: z.string().optional().nullable(),
    gemCount: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .transform((v) => (v ? Number(v) : null)),
    caratWeight: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .transform((v) => (v ? Number(v) : null)),
    images: z.array(z.string()).default([]),
    isActive: z.boolean().default(true),
    comingSoon: z.boolean().default(false),
    status: z.enum(['DRAFT', 'AI_DRAFT', 'LIVE']).default('DRAFT'),
    priority: z.coerce.number().int().default(0),
    priceVisibility: z.enum(['INHERIT', 'SHOW', 'HIDE']).default('INHERIT'),
    vaGoldPct: vaPct,
    vaLabel,
    pieces: z.array(pieceSchema).optional(),
    stones: z.array(stoneSchema).default([]),
    variants: z.array(variantSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.status !== 'LIVE') return
    const pieces = normalizePiecesFromBody(data)
    const variants = flattenPieceVariants(pieces)
    if (variants.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants'],
        message: 'A live product needs at least one variant',
      })
      return
    }
    if (!data.comingSoon && !variants.some((v) => Number(v.weightGrams) > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants'],
        message:
          'A live product needs at least one variant with a gold weight greater than 0 — otherwise no price ever shows on the storefront',
      })
    }
  })

function validationError(error: z.ZodError) {
  const flat = error.flatten()
  const first =
    error.issues[0]?.message ??
    Object.values(flat.fieldErrors).flat()[0] ??
    'Validation failed'
  return NextResponse.json(
    { error: first, fields: flat.fieldErrors, formErrors: flat.formErrors },
    { status: 400 },
  )
}

export async function GET() {
  await requireAdmin()
  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    include: { variants: true, pieces: true },
  })
  return NextResponse.json(sortProductsByPriority(products))
}

export async function POST(req: NextRequest) {
  await requireAdmin()

  const body = await req.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  const data = parsed.data
  const pieces = normalizePiecesFromBody(data)
  const dbCategory = toPrismaProductCategory(data.category) ?? 'PENDANTS'
  const first = pieces[0]

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: data.name,
        description: data.description,
        category: dbCategory,
        itemCode: data.itemCode || null,
        designStyle: data.designStyle || null,
        totalLengthMm: data.totalLengthMm,
        motifSizeMm: data.motifSizeMm,
        thicknessMm: data.thicknessMm,
        stoneType: data.stoneType || null,
        stoneShape: data.stoneShape || null,
        stoneDimMm: data.stoneDimMm || null,
        gemCount: data.gemCount,
        caratWeight: data.caratWeight,
        images: data.images,
        isActive: data.isActive,
        comingSoon: data.comingSoon,
        status: data.status,
        priority: data.priority,
        priceVisibility: data.priceVisibility,
        vaGoldPct: first?.vaGoldPct ?? data.vaGoldPct ?? null,
        vaLabel: first?.vaLabel ?? data.vaLabel ?? null,
      },
    })
    await createProductPieces(tx, created.id, pieces)
    return tx.product.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        pieces: { orderBy: { sortOrder: 'asc' }, include: { variants: true, stones: true } },
        variants: true,
        stones: { include: { diamondRate: true } },
      },
    })
  })

  setProductPriority(product.id, data.priority)

  try {
    const catSlug = data.category.toLowerCase().replace(/_/g, '-')
    await assignProductToStoreCategory(catSlug, product.id)
  } catch (err) {
    console.warn('[api/admin/products] failed linking to store category:', err)
  }

  return NextResponse.json(product, { status: 201 })
}
