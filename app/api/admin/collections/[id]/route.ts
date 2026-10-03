import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .optional(),
  title: z.string().trim().min(2).max(80).optional(),
  subtitle: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  heroImages: z.array(z.string()).optional(),
  coverMode: z.enum(['CUSTOM', 'COLLAGE']).optional(),
  seoTitle: z.string().trim().max(120).nullable().optional(),
  seoDescription: z.string().trim().max(300).nullable().optional(),
  active: z.boolean().optional(),
  showInNav: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  productIds: z.array(z.string()).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid collection' },
      { status: 400 },
    )
  }
  const d = parsed.data

  try {
    const collection = await prisma.$transaction(async (tx) => {
      if (d.productIds !== undefined) {
        await tx.collectionProduct.deleteMany({ where: { collectionId: id } })
        if (d.productIds.length) {
          await tx.collectionProduct.createMany({
            data: d.productIds.map((productId, i) => ({ collectionId: id, productId, sortOrder: i })),
          })
        }
      }
      return tx.collection.update({
        where: { id },
        data: {
          ...(d.slug !== undefined && { slug: d.slug }),
          ...(d.title !== undefined && { title: d.title }),
          ...(d.subtitle !== undefined && { subtitle: d.subtitle || null }),
          ...(d.description !== undefined && { description: d.description || null }),
          ...(d.heroImages !== undefined && { heroImages: d.heroImages }),
          ...(d.coverMode !== undefined && { coverMode: d.coverMode }),
          ...(d.seoTitle !== undefined && { seoTitle: d.seoTitle || null }),
          ...(d.seoDescription !== undefined && { seoDescription: d.seoDescription || null }),
          ...(d.active !== undefined && { active: d.active }),
          ...(d.showInNav !== undefined && { showInNav: d.showInNav }),
          ...(d.sortOrder !== undefined && { sortOrder: d.sortOrder }),
        },
      })
    })
    return NextResponse.json(collection)
  } catch {
    return NextResponse.json({ error: 'Update failed (missing collection or duplicate slug)' }, { status: 409 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  await prisma.collection.delete({ where: { id } }).catch(() => {})
  return new NextResponse(null, { status: 204 })
}
