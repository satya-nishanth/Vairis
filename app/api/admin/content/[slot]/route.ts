import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isKnownContentSlot } from '@/lib/site-content'

export const dynamic = 'force-dynamic'

const putSchema = z.object({
  title: z.string().trim().max(200).optional().or(z.literal('')),
  subtitle: z.string().trim().max(500).optional().or(z.literal('')),
  imageUrl: z.string().trim().optional().or(z.literal('')),
  linkUrl: z.string().trim().optional().or(z.literal('')),
  ctaLabel: z.string().trim().max(60).optional().or(z.literal('')),
  active: z.boolean(),
})

function knownSlot(slot: string): boolean {
  return isKnownContentSlot(slot)
}

/** GET /api/admin/content/[slot] — current row (even inactive), for the edit form. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slot: string }> }) {
  await requireAdmin()
  const { slot } = await params
  if (!knownSlot(slot)) return NextResponse.json({ error: 'Unknown slot' }, { status: 404 })

  try {
    const banner = await prisma.siteBanner.findUnique({ where: { slot } })
    return NextResponse.json({ banner })
  } catch (err) {
    console.error('[admin/content GET]', err)
    return NextResponse.json(
      {
        error:
          'SiteBanner table missing. Apply scripts/apply-sitebanner-migration-cloud.sql in Supabase SQL Editor.',
      },
      { status: 503 },
    )
  }
}

/**
 * PUT /api/admin/content/[slot] — upsert banner content.
 * Empty strings clear a field (falls back to the built-in default at the
 * call site); `active: false` disables the whole override without losing
 * the saved content.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slot: string }> }) {
  await requireAdmin()
  const { slot } = await params
  if (!knownSlot(slot)) return NextResponse.json({ error: 'Unknown slot' }, { status: 404 })

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid content' },
      { status: 400 },
    )
  }
  const d = parsed.data
  const data = {
    title: d.title || null,
    subtitle: d.subtitle || null,
    imageUrl: d.imageUrl || null,
    linkUrl: d.linkUrl || null,
    ctaLabel: d.ctaLabel || null,
    active: d.active,
  }

  try {
    const banner = await prisma.siteBanner.upsert({
      where: { slot },
      create: { slot, ...data },
      update: data,
    })
    return NextResponse.json({ banner })
  } catch (err) {
    console.error('[admin/content PUT]', err)
    return NextResponse.json(
      {
        error:
          'SiteBanner table missing. Apply scripts/apply-sitebanner-migration-cloud.sql in Supabase SQL Editor.',
      },
      { status: 503 },
    )
  }
}
