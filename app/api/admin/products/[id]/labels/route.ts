import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import {
  getCategoryFilters,
  productLabelsFromTags,
  setProductLabels,
} from '@/lib/category-filters'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

const updateLabelsSchema = z.object({
  labels: z.array(z.string().trim()).default([]),
})

export async function GET(_: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, category: true, tags: { select: { group: true, value: true } } },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const catSlug = (product.category ?? '').toLowerCase().trim()
  const config = await getCategoryFilters(catSlug)

  return NextResponse.json({
    ok: true,
    productId: id,
    category: product.category,
    categorySlug: catSlug,
    labels: productLabelsFromTags(product.tags),
    availableLabels: config.labels,
    types: config.types,
    occasions: config.occasions,
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
    select: { id: true, category: true },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const catSlug = (product.category ?? '').toLowerCase().trim()
  const updatedConfig = await setProductLabels(id, catSlug, parsed.data.labels)
  const tags = await prisma.productTag.findMany({
    where: { productId: id },
    select: { group: true, value: true },
  })

  return NextResponse.json({
    ok: true,
    productId: id,
    category: product.category,
    categorySlug: catSlug,
    labels: productLabelsFromTags(tags),
    availableLabels: updatedConfig.labels,
    types: updatedConfig.types,
    occasions: updatedConfig.occasions,
  })
}
