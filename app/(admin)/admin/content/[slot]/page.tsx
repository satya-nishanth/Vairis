import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  KNOWN_SLOTS,
  bannerImageList,
  isKnownContentSlot,
  parseCategoryHeroSlot,
} from '@/lib/site-content'
import { normalizeImageFits } from '@/lib/banner-image-fit'
import { CATEGORY_LABELS } from '@/lib/catalogue-ui'
import { getCategoryHeroImages } from '@/lib/category-hero-images'
import { CATEGORY_STORIES } from '@/lib/category-stories'
import { getHeroSlides } from '@/lib/ui-data'
import { ContentEditor } from '../ContentEditor'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slot: string }>
}

export default async function AdminContentEditPage({ params }: PageProps) {
  const { slot: raw } = await params
  const slot = decodeURIComponent(raw)

  if (!isKnownContentSlot(slot)) notFound()

  const meta = KNOWN_SLOTS.find((s) => s.slot === slot)
  const category = parseCategoryHeroSlot(slot)
  const label = meta?.label ?? (category ? CATEGORY_LABELS[category].title : slot)
  const description = meta?.description ?? `Content slot ${slot}`

  let row: Awaited<ReturnType<typeof prisma.siteBanner.findUnique>> = null
  let dbMissing = false
  try {
    row = await prisma.siteBanner.findUnique({ where: { slot } })
  } catch (err) {
    console.error('[admin/content/edit] SiteBanner query failed', err)
    dbMissing = true
  }

  const story = category ? CATEGORY_STORIES[category]?.[0] : undefined
  const builtInImages =
    slot === 'home-hero'
      ? [...getHeroSlides()]
      : category
        ? getCategoryHeroImages(category)
        : []

  const images = bannerImageList(row)

  return (
    <div className="admin-page" style={{ maxWidth: 1100 }}>
      <p style={{ marginBottom: 12, fontSize: '0.8125rem' }}>
        <Link href="/admin/content" style={{ color: '#032b24', textDecoration: 'none' }}>
          ← Site Content
        </Link>
      </p>

      {dbMissing ? (
        <div
          style={{
            padding: '1rem 1.25rem',
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: 8,
            color: '#92400e',
            fontSize: '0.875rem',
          }}
        >
          <strong>Database migration required.</strong> Run{' '}
          <code>scripts/apply-sitebanner-migration-cloud.sql</code> in Supabase SQL Editor, then
          reload.
        </div>
      ) : (
        <ContentEditor
          slot={slot}
          label={label}
          description={description}
          defaultIntro={category ? CATEGORY_LABELS[category].intro : undefined}
          builtInImages={builtInImages}
          builtInLine1={story?.line1}
          builtInLine2={story?.line2}
          initial={
            row
              ? {
                  title: row.title ?? '',
                  subtitle: row.subtitle ?? '',
                  images,
                  imageFits: normalizeImageFits(
                    images,
                    (row as { imageFits?: unknown }).imageFits,
                  ),
                  linkUrl: row.linkUrl ?? '',
                  ctaLabel: row.ctaLabel ?? '',
                  active: row.active,
                }
              : null
          }
        />
      )}
    </div>
  )
}
