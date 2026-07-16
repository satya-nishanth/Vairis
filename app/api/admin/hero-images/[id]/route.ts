import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  url: z.string().url().optional(),
  isActive: z.boolean().optional(),
})

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()

    const existing = await prisma.heroImage.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const image = await prisma.heroImage.update({
      where: { id: params.id },
      data: parsed.data,
    })

    revalidatePath('/')
    return NextResponse.json(image)
  } catch (err) {
    console.error('[hero-images PATCH]', err)
    return NextResponse.json({ error: 'Failed to update hero image' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()

    const existing = await prisma.heroImage.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.heroImage.delete({ where: { id: params.id } })

    const remaining = await prisma.heroImage.findMany({ orderBy: { sortOrder: 'asc' } })
    await prisma.$transaction(
      remaining.map((img, index) =>
        prisma.heroImage.update({ where: { id: img.id }, data: { sortOrder: index } })
      )
    )

    revalidatePath('/')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[hero-images DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete hero image' }, { status: 500 })
  }
}
