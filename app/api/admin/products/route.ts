import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

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

  const {
    name, description, category, itemCode, designStyle,
    totalLengthMm, motifSizeMm, thicknessMm,
    stoneType, stoneShape, stoneDimMm, gemCount, caratWeight,
    images = [],
    variants = [],
    isActive = true,
  } = body

  const product = await prisma.product.create({
    data: {
      name,
      description,
      category,
      itemCode: itemCode || null,
      designStyle: designStyle || null,
      totalLengthMm: totalLengthMm ? Number(totalLengthMm) : null,
      motifSizeMm: motifSizeMm ? Number(motifSizeMm) : null,
      thicknessMm: thicknessMm ? Number(thicknessMm) : null,
      stoneType: stoneType || null,
      stoneShape: stoneShape || null,
      stoneDimMm: stoneDimMm || null,
      gemCount: gemCount ? Number(gemCount) : null,
      caratWeight: caratWeight ? Number(caratWeight) : null,
      images,
      isActive,
      variants: {
        create: variants.map((v: any) => ({
          metalType: v.metalType,
          weightGrams: Number(v.weightGrams),
          stock: Number(v.stock ?? 0),
          sku: v.sku,
          size: v.size || null,
        })),
      },
    },
    include: { variants: true },
  })

  return NextResponse.json(product, { status: 201 })
}
