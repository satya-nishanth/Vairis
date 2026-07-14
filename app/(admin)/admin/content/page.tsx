import { prisma } from '@/lib/prisma'
import {
  CATEGORY_HERO_SLOTS,
  OTHER_SHOP_HERO_SLOTS,
  KNOWN_SLOTS,
} from '@/lib/site-content'
import { CATEGORY_LABELS, type ShopCategory } from '@/lib/catalogue-ui'
import { ContentEditor } from './ContentEditor'

export const dynamic = 'force-dynamic'

/**
 * Admin site content - global banners + per-navbar category heroes.
 * Storefront falls back to built-in assets when a slot is empty/inactive.
 */
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

  const editor = (slot: string, description: string, label?: string, defaultIntro?: string) => {
    const row = bySlot[slot]
    return (
      <ContentEditor
        key={slot}
        slot={slot}
        label={label}
        description={description}
        defaultIntro={defaultIntro}
        initial={
          row
            ? {
                title: row.title ?? '',
                subtitle: row.subtitle ?? '',
                imageUrl: row.imageUrl ?? '',
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

  return (
    <div style={{ padding: '1.25rem 2rem 3rem', maxWidth: 1100 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Site Content
      </h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.35rem', maxWidth: 640 }}>
        Edit each navbar category hero with a live preview. Upload an image to see it immediately,
        then save to publish.
      </p>
      <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1.5rem' }}>
        New nav category: add it to <code>HEADER_NAV_CATEGORIES</code> - an upload card appears here
        automatically.
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
          <strong>Database migration required.</strong> Table <code>SiteBanner</code> is missing on
          cloud. Run <code>scripts/apply-sitebanner-migration-cloud.sql</code> in Supabase SQL
          Editor, then reload.
        </div>
      )}

      <h2 style={sectionTitle}>Category heroes (navbar)</h2>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.75rem' }}>
        Necklaces, Earrings, Rings, Bracelets, Pendants - headline, intro, and image for each shop
        page.
      </p>
      {CATEGORY_HERO_SLOTS.map((s) => {
        const slug = s.slot.replace('plp-hero-', '') as ShopCategory
        return editor(s.slot, s.description, s.label, CATEGORY_LABELS[slug]?.intro)
      })}

      {OTHER_SHOP_HERO_SLOTS.length > 0 && (
        <>
          <h2 style={sectionTitle}>Other shop categories</h2>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.75rem' }}>
            Not in the main nav yet - prepare banners before you add them to the header.
          </p>
          {OTHER_SHOP_HERO_SLOTS.map((s) => {
            const slug = s.slot.replace('plp-hero-', '') as ShopCategory
            return editor(s.slot, s.description, s.label, CATEGORY_LABELS[slug]?.intro)
          })}
        </>
      )}

      <h2 style={sectionTitle}>Global</h2>
      {KNOWN_SLOTS.filter((s) => s.group === 'global').map((s) =>
        editor(s.slot, s.description, s.label),
      )}
    </div>
  )
}
