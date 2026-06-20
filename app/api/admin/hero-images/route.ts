import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { MAX_HERO_IMAGES } from '@/lib/hero-images'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  url: z.string().url('Invalid image URL'),
})

export async function GET() {
  try {
    await requireAdmin()
    const images = await prisma.heroImage.findMany({ orderBy: { sortOrder: 'asc' } })
    return NextResponse.json(images)
  } catch (err) {
    console.error('[hero-images GET]', err)
    return NextResponse.json({ error: 'Failed to load hero images' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const count = await prisma.heroImage.count()
    if (count >= MAX_HERO_IMAGES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_HERO_IMAGES} hero images allowed` },
        { status: 400 }
      )
    }

    const maxOrder = await prisma.heroImage.aggregate({ _max: { sortOrder: true } })
    const image = await prisma.heroImage.create({
      data: {
        url: parsed.data.url,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        isActive: true,
      },
    })

    revalidatePath('/')
    return NextResponse.json(image, { status: 201 })
  } catch (err) {
    console.error('[hero-images POST]', err)
    return NextResponse.json({ error: 'Failed to save hero image' }, { status: 500 })
  }
}
