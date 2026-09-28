import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import {
  getAllCategoryFilters,
  getProductLinkedLabels,
  setProductLabels,
  getDefaultFilterConfig,
} from '@/lib/category-filters'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

const updateLabelsSchema = z.object({
  labels: z.array(z.string().trim()).default([]),
})

export async function GET(_: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params

  const [product, allFilters] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        itemCode: true,
        category: true,
        designStyle: true,
        description: true,
      },
    }),
    getAllCategoryFilters(),
  ])

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const catSlug = (product.category ?? '').toLowerCase().trim()
  const config = allFilters[catSlug] || allFilters[catSlug.replace(/s$/, '')] || getDefaultFilterConfig(catSlug)
  const linkedLabels = getProductLinkedLabels(product, allFilters)

  return NextResponse.json({
    ok: true,
    productId: id,
    category: product.category,
    categorySlug: catSlug,
    labels: linkedLabels,
    availableLabels: config.labels || [],
  })
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const parsed = updateLabelsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid labels payload' },
      { status: 400 }
    )
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      itemCode: true,
      category: true,
      designStyle: true,
      description: true,
    },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const catSlug = (product.category ?? '').toLowerCase().trim()
  const updatedConfig = await setProductLabels(id, catSlug, parsed.data.labels, product)

  // Recalculate linked labels
  const linkedLabels = getProductLinkedLabels(product, updatedConfig)

  return NextResponse.json({
    ok: true,
    productId: id,
    category: product.category,
    categorySlug: catSlug,
    labels: linkedLabels,
    availableLabels: updatedConfig.labels,
  })
}
