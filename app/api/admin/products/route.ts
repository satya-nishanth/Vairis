import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const CATEGORIES = ['RINGS', 'EARRINGS', 'PENDANTS', 'BRACELETS', 'NECKLACES'] as const

const variantSchema = z.object({
  metalType: z.enum(['GOLD_18K', 'GOLD_14K', 'ROSE_GOLD']),
  // 0 allowed for catalogue stubs / coming-soon — priced variants need > 0
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
})

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().default(''),
  category: z.enum(CATEGORIES),
  itemCode: z.string().optional().nullable(),
  designStyle: z.string().optional().nullable(),
  totalLengthMm: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v ? Number(v) : null)),
  motifSizeMm: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v ? Number(v) : null)),
  thicknessMm: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v ? Number(v) : null)),
  stoneType: z.string().optional().nullable(),
  stoneShape: z.string().optional().nullable(),
  stoneDimMm: z.string().optional().nullable(),
  gemCount: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v ? Number(v) : null)),
  caratWeight: z.union([z.string(), z.number(), z.null()]).optional().transform((v) => (v ? Number(v) : null)),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  comingSoon: z.boolean().default(false),
  status: z.enum(['DRAFT', 'AI_DRAFT', 'LIVE']).default('DRAFT'),
  priceVisibility: z.enum(['INHERIT', 'SHOW', 'HIDE']).default('INHERIT'),
  stones: z.array(stoneSchema).default([]),
  // Drafts only need a title — LIVE products need at least one variant
  // (enforced in superRefine below).
  variants: z.array(variantSchema).default([]),
}).superRefine((data, ctx) => {
  if (data.status !== 'LIVE') return
  if (data.variants.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['variants'],
      message: 'A live product needs at least one variant',
    })
    return
  }
  // A variant with weight 0 silently produces no price at all on the
  // storefront (calculatePrice requires weight > 0) — the PDP just shows
  // "Enquire on WhatsApp" with no indication anything is wrong. Coming-soon
  // products are exempt since they're allowed to ship without pricing yet.
  if (!data.comingSoon && !data.variants.some((v) => Number(v.weightGrams) > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['variants'],
      message: 'A live product needs at least one variant with a gold weight greater than 0 — otherwise no price ever shows on the storefront',
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
    orderBy: { createdAt: 'desc' },
    include: { variants: true },
  })
  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  await requireAdmin()

  const body = await req.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  const data = parsed.data
  const product = await prisma.product.create({
    data: {
      name: data.name,
      description: data.description,
      category: data.category,
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
      priceVisibility: data.priceVisibility,
      stones: {
        create: data.stones.map((s, i) => ({
          diamondRateId: s.diamondRateId,
          caratWeight: s.caratWeight,
          count: s.count,
          label: s.label || null,
          sortOrder: i,
        })),
      },
      variants: {
        create: data.variants.map((v) => ({
          metalType: v.metalType,
          weightGrams: v.weightGrams,
          makingChargePerGram: v.makingChargePerGram,
          flatMakingCharge: v.flatMakingCharge,
          stoneCharges: v.stoneCharges,
          miscCharges: v.miscCharges,
          stock: v.stock,
          sku: v.sku,
          size: v.size || null,
        })),
      },
    },
    include: { variants: true, stones: { include: { diamondRate: true } } },
  })

  return NextResponse.json(product, { status: 201 })
}
