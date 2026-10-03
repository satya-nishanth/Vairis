import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const collectionSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')),
  title: z.string().trim().min(2).max(80),
  subtitle: z.string().trim().max(160).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  heroImages: z.array(z.string()).default([]),
  coverMode: z.enum(['CUSTOM', 'COLLAGE']).default('CUSTOM'),
  seoTitle: z.string().trim().max(120).optional().nullable(),
  seoDescription: z.string().trim().max(300).optional().nullable(),
  active: z.boolean().default(true),
  showInNav: z.boolean().default(false),
  productIds: z.array(z.string()).default([]),
})

export async function GET() {
  await requireAdmin()
  const collections = await prisma.collection.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { products: { orderBy: { sortOrder: 'asc' }, select: { productId: true } } },
  })
  return NextResponse.json(
    collections.map((c) => ({ ...c, productIds: c.products.map((p) => p.productId) })),
  )
}

export async function POST(req: NextRequest) {
  await requireAdmin()
  const parsed = collectionSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid collection' },
      { status: 400 },
    )
  }
  const d = parsed.data
  try {
    const max = await prisma.collection.aggregate({ _max: { sortOrder: true } })
    const collection = await prisma.collection.create({
      data: {
        slug: d.slug,
        title: d.title,
        subtitle: d.subtitle || null,
        description: d.description || null,
        heroImages: d.heroImages,
        coverMode: d.coverMode,
        seoTitle: d.seoTitle || null,
        seoDescription: d.seoDescription || null,
        active: d.active,
        showInNav: d.showInNav,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
        products: {
          create: d.productIds.map((productId, i) => ({ productId, sortOrder: i })),
        },
      },
    })
    return NextResponse.json(collection, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'A collection with this slug already exists' }, { status: 409 })
  }
}
