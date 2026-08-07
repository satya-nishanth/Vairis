import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  title: z.string().trim().max(120).nullable().optional(),
  subtitle: z.string().trim().max(240).nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid section' },
      { status: 400 },
    )
  }
  const d = parsed.data
  try {
    const section = await prisma.homeSection.update({
      where: { id },
      data: {
        ...(d.title !== undefined && { title: d.title || null }),
        ...(d.subtitle !== undefined && { subtitle: d.subtitle || null }),
        ...(d.config !== undefined && { config: d.config as object }),
        ...(d.active !== undefined && { active: d.active }),
        ...(d.sortOrder !== undefined && { sortOrder: d.sortOrder }),
        ...(d.startsAt !== undefined && { startsAt: d.startsAt ? new Date(d.startsAt) : null }),
        ...(d.endsAt !== undefined && { endsAt: d.endsAt ? new Date(d.endsAt) : null }),
      },
    })
    return NextResponse.json(section)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  await prisma.homeSection.delete({ where: { id } }).catch(() => {})
  return new NextResponse(null, { status: 204 })
}
