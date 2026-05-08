import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

type Params = Promise<{ id: string }>

const patchVariantSchema = z.object({
  metalType: z.enum(['GOLD_18K', 'GOLD_22K', 'SILVER_925', 'ROSE_GOLD'] as const),
  weightGrams: z
    .union([z.string(), z.number()])
    .transform(Number)
    .refine((n) => n > 0, 'Weight must be greater than 0'),
  makingChargePerGram: z
    .union([z.string(), z.number()])
    .transform(Number)
    .refine((n) => n >= 0, 'Making charge cannot be negative'),
  flatMakingCharge: z.union([z.string(), z.number()]).transform(Number).default(0),
  stoneCharges: z.union([z.string(), z.number()]).transform(Number).default(0),
  miscCharges: z.union([z.string(), z.number()]).transform(Number).default(45),
  stock: z.union([z.string(), z.number()]).transform(Number).default(0),
  sku: z.string().min(1, 'SKU is required'),
  size: z.string().optional(),
})

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.enum(['RINGS', 'EARRINGS', 'PENDANTS', 'BRACELETS'] as const).optional(),
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
  variants: z.array(patchVariantSchema).min(1).optional(),
})

export async function GET(_: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: true },
  })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.flatten()
    return NextResponse.json(
      { error: 'Validation failed', fields: errors.fieldErrors },
      { status: 400 }
    )
  }

  const data = parsed.data
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.category !== undefined && { category: data.category }),
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
      ...(data.variants !== undefined && {
        variants: {
          deleteMany: {},
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
      }),
    },
    include: { variants: true },
  })

  return NextResponse.json(product)
}

export async function DELETE(_: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params
  await prisma.product.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
