import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeImageFits, parseBannerFit } from '@/lib/banner-image-fit'
import { bannerImageList, isKnownContentSlot } from '@/lib/site-content'

export const dynamic = 'force-dynamic'

const fitSchema = z.object({
  webX: z.number().min(0).max(100),
  webY: z.number().min(0).max(100),
  mobileX: z.number().min(0).max(100),
  mobileY: z.number().min(0).max(100),
})

const putSchema = z.object({
  title: z.string().trim().max(200).optional().or(z.literal('')),
  subtitle: z.string().trim().max(500).optional().or(z.literal('')),
  imageUrl: z.string().trim().optional().or(z.literal('')),
  images: z.array(z.string().min(1)).optional(),
  imageFits: z.array(fitSchema).optional(),
  linkUrl: z.string().trim().optional().or(z.literal('')),
  ctaLabel: z.string().trim().max(500).optional().or(z.literal('')),
  active: z.boolean(),
})

function knownSlot(slot: string): boolean {
  return isKnownContentSlot(slot)
}

function bannerPayload(banner: {
  images?: string[] | null
  imageUrl?: string | null
  imageFits?: unknown
  [key: string]: unknown
}) {
  const images = bannerImageList(banner)
  return {
    ...banner,
    images,
    imageFits: normalizeImageFits(images, banner.imageFits),
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slot: string }> }) {
  await requireAdmin()
  const { slot } = await params
  if (!knownSlot(slot)) return NextResponse.json({ error: 'Unknown slot' }, { status: 404 })

  try {
    const banner = await prisma.siteBanner.findUnique({ where: { slot } })
    if (!banner) return NextResponse.json({ banner: null })
    return NextResponse.json({ banner: bannerPayload(banner) })
  } catch (err) {
    console.error('[admin/content GET]', err)
    return NextResponse.json(
      {
        error:
          'SiteBanner table missing or needs images/imageFits columns. Run scripts/apply-sitebanner-migration-cloud.sql',
      },
      { status: 503 },
    )
  }
}

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
  const images = (d.images ?? []).map((u) => u.trim()).filter(Boolean)
  // Keep legacy imageUrl in sync with first slide for older readers
  const imageUrl = images[0] || d.imageUrl || null
  const imageFits = normalizeImageFits(images, d.imageFits?.map(parseBannerFit) ?? [])

  const data = {
    title: d.title || null,
    subtitle: d.subtitle || null,
    imageUrl,
    images,
    imageFits,
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
    return NextResponse.json({ banner: bannerPayload(banner) })
  } catch (err) {
    console.error('[admin/content PUT]', err)
    return NextResponse.json(
      {
        error:
          'Could not save banner. Ensure SiteBanner.images and imageFits columns exist (scripts/apply-sitebanner-migration-cloud.sql).',
      },
      { status: 503 },
    )
  }
}
