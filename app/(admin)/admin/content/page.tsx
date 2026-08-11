import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  CATEGORY_HERO_SLOTS,
  OTHER_SHOP_HERO_SLOTS,
  KNOWN_SLOTS,
  bannerImageList,
  type ContentSlot,
} from '@/lib/site-content'
import type { ShopCategory } from '@/lib/catalogue-ui'
import { getCategoryHeroImages } from '@/lib/category-hero-images'
import { getHeroSlides } from '@/lib/ui-data'
import { AdminGuide } from '@/components/admin/AdminGuide'

export const dynamic = 'force-dynamic'

type ListItem = {
  slot: ContentSlot
  images: string[]
  active: boolean
  hasCustom: boolean
  builtInCount: number
}

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

  function toItem(s: ContentSlot): ListItem {
    const row = bySlot[s.slot]
    const images = bannerImageList(row)
    const slug = s.slot.replace('plp-hero-', '') as ShopCategory
    const builtIns =
      s.slot === 'home-hero'
        ? homeBuiltIns
        : s.slot.startsWith('plp-hero-')
          ? getCategoryHeroImages(slug)
          : []
    const hasCustom = Boolean(
      images.length ||
        row?.title ||
        row?.subtitle ||
        (s.slot.startsWith('plp-hero-') ? row?.ctaLabel : false),
    )
    return {
      slot: s,
      images: images.length ? images : builtIns,
      active: row?.active ?? true,
      hasCustom,
      builtInCount: builtIns.length,
    }
  }

  const navItems = CATEGORY_HERO_SLOTS.map(toItem)
  const otherItems = OTHER_SHOP_HERO_SLOTS.map(toItem)
  const globalItems = KNOWN_SLOTS.filter((s) => s.group === 'global').map(toItem)

  return (
    <div className="admin-page" style={{ maxWidth: 960 }}>
      <h1 className="admin-page__title">Site Content</h1>
      <AdminGuide
        pageKey="content"
        title="Content"
        blurb="Homepage/PLP hero banners + category headline text."
        tips={[
          'Click Edit to open the full page with live storefront preview.',
          'Changes go live immediately — no draft/preview beyond the built-in preview pane.',
        ]}
      />

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
          <code>scripts/apply-sitebanner-migration-cloud.sql</code> in Supabase SQL Editor, then
          reload.
        </div>
      )}

      <Section title="Category heroes (navbar)" items={navItems} />
      {otherItems.length > 0 && <Section title="Other shop categories" items={otherItems} />}
      <Section title="Global" items={globalItems} />
    </div>
  )
}

function Section({ title, items }: { title: string; items: ListItem[] }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2
        style={{
          fontSize: '0.75rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#6b7280',
          margin: '0 0 0.75rem',
        }}
      >
        {title}
      </h2>
      <ul className="content-slot-list">
        {items.map((item) => {
          const thumb = item.images[0]
          const status = !item.active ? 'Off' : item.hasCustom ? 'Custom' : 'Built-in'
          const statusColor =
            status === 'Custom' ? '#15803d' : status === 'Off' ? '#9ca3af' : '#0369a1'
          return (
            <li key={item.slot.slot} className="content-slot-list__item">
              <div className="content-slot-list__thumb">
                {thumb ? (
                   
                  <img src={thumb} alt="" />
                ) : (
                  <span>NO IMG</span>
                )}
                {item.images.length > 1 && (
                  <em>{item.images.length}</em>
                )}
              </div>
              <div className="content-slot-list__body">
                <div className="content-slot-list__title-row">
                  <strong>{item.slot.label}</strong>
                  <span style={{ color: statusColor, background: `${statusColor}18` }}>{status}</span>
                </div>
                <p>{item.slot.description}</p>
              </div>
              <Link href={`/admin/content/${encodeURIComponent(item.slot.slot)}`} className="admin-btn">
                Edit
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
