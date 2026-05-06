import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

type Params = Promise<{ id: string }>

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

  const {
    name, description, category, itemCode, designStyle,
    totalLengthMm, motifSizeMm, thicknessMm,
    stoneType, stoneShape, stoneDimMm, gemCount, caratWeight,
    images, isActive,
    variants,
  } = body

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(itemCode !== undefined && { itemCode: itemCode || null }),
      ...(designStyle !== undefined && { designStyle: designStyle || null }),
      ...(totalLengthMm !== undefined && { totalLengthMm: totalLengthMm ? Number(totalLengthMm) : null }),
      ...(motifSizeMm !== undefined && { motifSizeMm: motifSizeMm ? Number(motifSizeMm) : null }),
      ...(thicknessMm !== undefined && { thicknessMm: thicknessMm ? Number(thicknessMm) : null }),
      ...(stoneType !== undefined && { stoneType: stoneType || null }),
      ...(stoneShape !== undefined && { stoneShape: stoneShape || null }),
      ...(stoneDimMm !== undefined && { stoneDimMm: stoneDimMm || null }),
      ...(gemCount !== undefined && { gemCount: gemCount ? Number(gemCount) : null }),
      ...(caratWeight !== undefined && { caratWeight: caratWeight ? Number(caratWeight) : null }),
      ...(images !== undefined && { images }),
      ...(isActive !== undefined && { isActive }),
      ...(variants !== undefined && {
        variants: {
          deleteMany: {},
          create: variants.map((v: any) => ({
            metalType: v.metalType,
            weightGrams: Number(v.weightGrams),
            stock: Number(v.stock ?? 0),
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
