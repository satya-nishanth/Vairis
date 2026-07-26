import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

const CATEGORIES = ['RINGS', 'EARRINGS', 'PENDANTS', 'BRACELETS', 'NECKLACES'] as const

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

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.enum(CATEGORIES).optional(),
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
  stones: z
    .array(
      z.object({
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
      }),
    )
    .optional(),
  // Drafts may have zero variants; LIVE needs ≥1 (checked against DB state below).
  variants: z.array(patchVariantSchema).optional(),
})

export async function GET(_: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: true, stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } } },
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
      // A product being made (or kept) LIVE must end up with ≥1 variant.
      const targetStatus =
        data.status ?? (await tx.product.findUniqueOrThrow({ where: { id }, select: { status: true } })).status
      if (targetStatus === 'LIVE') {
        const variantCount =
          data.variants !== undefined
            ? data.variants.length
            : await tx.productVariant.count({ where: { productId: id } })
        if (variantCount < 1) {
          throw new Error('A live product needs at least one variant')
        }
      }

      // Stones have no order/cart FKs — replace wholesale.
      if (data.stones !== undefined) {
        await tx.productStone.deleteMany({ where: { productId: id } })
        if (data.stones.length) {
          await tx.productStone.createMany({
            data: data.stones.map((s, i) => ({
              productId: id,
              diamondRateId: s.diamondRateId,
              caratWeight: s.caratWeight,
              count: s.count,
              label: s.label || null,
              sortOrder: i,
            })),
          })
        }
      }

      // Upsert variants by SKU so cart/order FKs stay valid (deleteMany breaks them).
      if (data.variants !== undefined) {
        const existing = await tx.productVariant.findMany({ where: { productId: id } })
        const bySku = new Map(existing.map((v) => [v.sku, v]))
        const keepIds = new Set<string>()

        for (const v of data.variants) {
          const found = bySku.get(v.sku)
          const fields = {
            metalType: v.metalType,
            weightGrams: v.weightGrams,
            makingChargePerGram: v.makingChargePerGram,
            flatMakingCharge: v.flatMakingCharge,
            stoneCharges: v.stoneCharges,
            miscCharges: v.miscCharges,
            stock: v.stock,
            size: v.size || null,
          }

          if (found) {
            await tx.productVariant.update({ where: { id: found.id }, data: fields })
            keepIds.add(found.id)
          } else {
            const created = await tx.productVariant.create({
              data: { productId: id, sku: v.sku, ...fields },
            })
            keepIds.add(created.id)
          }
        }

        const toRemove = existing.filter((v) => !keepIds.has(v.id))
        if (toRemove.length) {
          const removeIds = toRemove.map((v) => v.id)
          const orderRefs = await tx.orderItem.count({ where: { variantId: { in: removeIds } } })
          if (orderRefs > 0) {
            throw new Error(
              'Cannot remove a variant that appears on past orders. Keep the SKU or contact support.',
            )
          }
          // Drop cart lines pointing at removed variants, then delete.
          await tx.cartItem.deleteMany({ where: { variantId: { in: removeIds } } })
          await tx.productVariant.deleteMany({ where: { id: { in: removeIds } } })
        }
      }

      return tx.product.update({
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
          ...(data.comingSoon !== undefined && { comingSoon: data.comingSoon }),
          ...(data.status !== undefined && { status: data.status }),
        },
        include: { variants: true, stones: { include: { diamondRate: true } } },
      })
    })

    return NextResponse.json(product)
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
