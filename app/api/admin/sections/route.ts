import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const KINDS = ['collection-rail', 'editorial', 'video', 'usp'] as const

const sectionSchema = z.object({
  kind: z.enum(KINDS),
  title: z.string().trim().max(120).optional().nullable(),
  subtitle: z.string().trim().max(240).optional().nullable(),
  config: z.record(z.string(), z.unknown()).default({}),
  active: z.boolean().default(true),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
})

export async function GET() {
  await requireAdmin()
  const sections = await prisma.homeSection.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json(sections)
}

export async function POST(req: NextRequest) {
  await requireAdmin()
  const parsed = sectionSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid section' },
      { status: 400 },
    )
  }
  const d = parsed.data
  const max = await prisma.homeSection.aggregate({ _max: { sortOrder: true } })
  const section = await prisma.homeSection.create({
    data: {
      kind: d.kind,
      title: d.title || null,
      subtitle: d.subtitle || null,
      config: d.config as object,
      active: d.active,
      startsAt: d.startsAt ? new Date(d.startsAt) : null,
      endsAt: d.endsAt ? new Date(d.endsAt) : null,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  })
  return NextResponse.json(section, { status: 201 })
}
