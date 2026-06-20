import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
})

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json()
    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await prisma.heroImage.findMany({ select: { id: true } })
    const existingIds = new Set(existing.map((img) => img.id))
    const incomingIds = parsed.data.ids

    if (incomingIds.length !== existing.length) {
      return NextResponse.json({ error: 'Must include all hero image IDs' }, { status: 400 })
    }

    if (incomingIds.some((id) => !existingIds.has(id))) {
      return NextResponse.json({ error: 'Unknown hero image ID' }, { status: 400 })
    }

    await prisma.$transaction(
      incomingIds.map((id, index) =>
        prisma.heroImage.update({ where: { id }, data: { sortOrder: index } })
      )
    )

    const images = await prisma.heroImage.findMany({ orderBy: { sortOrder: 'asc' } })
    revalidatePath('/')
    return NextResponse.json(images)
  } catch (err) {
    console.error('[hero-images reorder]', err)
    return NextResponse.json({ error: 'Failed to reorder hero images' }, { status: 500 })
  }
}
