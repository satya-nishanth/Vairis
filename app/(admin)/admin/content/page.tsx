import { prisma } from '@/lib/prisma'
import {
  CATEGORY_HERO_SLOTS,
  OTHER_SHOP_HERO_SLOTS,
  KNOWN_SLOTS,
  bannerImageList,
} from '@/lib/site-content'
import { CATEGORY_LABELS, type ShopCategory } from '@/lib/catalogue-ui'
import { getCategoryHeroImages } from '@/lib/category-hero-images'
import { CATEGORY_STORIES } from '@/lib/category-stories'
import { getHeroSlides } from '@/lib/ui-data'
import { ContentEditor } from './ContentEditor'

export const dynamic = 'force-dynamic'

export default async function AdminContentPage() {
  let rows: Awaited<ReturnType<typeof prisma.siteBanner.findMany>> = []
  let dbMissing = false

  try {
    rows = await prisma.siteBanner.findMany()
  } catch (err) {
    console.error('[admin/content] SiteBanner query failed', err)
    dbMissing = true
  }

  const bySlot = Object.fromEntries(rows.map((r) => [r.slot, r]))
  const homeBuiltIns = [...getHeroSlides()]

  const editor = (
    slot: string,
    description: string,
    label?: string,
    extras?: {
      defaultIntro?: string
      builtInImages?: string[]
      builtInLine1?: string
      builtInLine2?: string
    },
  ) => {
    const row = bySlot[slot]
    const images = bannerImageList(row)
    return (
      <ContentEditor
        key={slot}
        slot={slot}
        label={label}
        description={description}
        defaultIntro={extras?.defaultIntro}
        builtInImages={extras?.builtInImages}
        builtInLine1={extras?.builtInLine1}
        builtInLine2={extras?.builtInLine2}
        initial={
          row
            ? {
                title: row.title ?? '',
                subtitle: row.subtitle ?? '',
                images,
                linkUrl: row.linkUrl ?? '',
                ctaLabel: row.ctaLabel ?? '',
                active: row.active,
              }
            : null
        }
      />
    )
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: '0.75rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#6b7280',
    margin: '2rem 0 0.75rem',
  }

  function categoryExtras(slug: ShopCategory) {
    const story = CATEGORY_STORIES[slug]?.[0]
    return {
      defaultIntro: CATEGORY_LABELS[slug]?.intro,
      builtInImages: getCategoryHeroImages(slug),
      builtInLine1: story?.line1,
      builtInLine2: story?.line2,
    }
  }

  return (
    <div style={{ padding: '1.25rem 2rem 3rem', maxWidth: 1100 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Site Content
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.35rem', maxWidth: 720 }}>
        Upload <strong>any number</strong> of hero images per category. They play as a carousel on
        the shop. Built-in thumbnails show what is live until you save your own.
      </p>

      {dbMissing && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: 8,
            color: '#92400e',
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
        >
          <strong>Database migration required.</strong> Run{' '}
          <code>scripts/apply-sitebanner-migration-cloud.sql</code> in Supabase SQL Editor (includes
          unlimited <code>images</code> column), then reload.
        </div>
      )}

      <h2 style={sectionTitle}>Category heroes (navbar)</h2>
      {CATEGORY_HERO_SLOTS.map((s) => {
        const slug = s.slot.replace('plp-hero-', '') as ShopCategory
        return editor(s.slot, s.description, s.label, categoryExtras(slug))
      })}

      {OTHER_SHOP_HERO_SLOTS.length > 0 && (
        <>
          <h2 style={sectionTitle}>Other shop categories</h2>
          {OTHER_SHOP_HERO_SLOTS.map((s) => {
            const slug = s.slot.replace('plp-hero-', '') as ShopCategory
            return editor(s.slot, s.description, s.label, categoryExtras(slug))
          })}
        </>
      )}

      <h2 style={sectionTitle}>Global</h2>
      {KNOWN_SLOTS.filter((s) => s.group === 'global').map((s) =>
        editor(
          s.slot,
          s.description,
          s.label,
          s.slot === 'home-hero' ? { builtInImages: homeBuiltIns } : undefined,
        ),
      )}
    </div>
  )
}
