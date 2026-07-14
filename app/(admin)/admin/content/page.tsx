import { prisma } from '@/lib/prisma'
import {
  CATEGORY_HERO_SLOTS,
  OTHER_SHOP_HERO_SLOTS,
  KNOWN_SLOTS,
} from '@/lib/site-content'
import { ContentEditor } from './ContentEditor'

export const dynamic = 'force-dynamic'

/**
 * Admin site content — global banners + per-navbar category heroes.
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

  const editor = (slot: string, description: string, label?: string) => {
    const row = bySlot[slot]
    return (
      <ContentEditor
        key={slot}
        slot={slot}
        label={label}
        description={description}
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
    <div style={{ padding: '1rem 2rem', maxWidth: 860 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Site Content
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.5rem' }}>
        Upload a different hero banner for each navbar category. Empty / inactive slots keep the
        built-in design — you can&apos;t blank the shop from here.
      </p>
      <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1.5rem' }}>
        Adding a new nav category: add it to <code>HEADER_NAV_CATEGORIES</code> in{' '}
        <code>lib/catalogue-ui.ts</code> — a hero upload card appears here automatically.
      </p>

      {dbMissing && (
        <div
          style={{
            marginBottom: '1.5rem',
            padding: '1rem 1.25rem',
            background: '#fef3c7',
            border: '1px solid #f59e0b',
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
        Same order as the header: Necklaces, Earrings, Rings, Bracelets, Pendants.
      </p>
      {CATEGORY_HERO_SLOTS.map((s) => editor(s.slot, s.description, s.label))}

      {OTHER_SHOP_HERO_SLOTS.length > 0 && (
        <>
          <h2 style={sectionTitle}>Other shop categories</h2>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.75rem' }}>
            Not in the main nav yet — upload now so the banner is ready when you add them to the
            header.
          </p>
          {OTHER_SHOP_HERO_SLOTS.map((s) => editor(s.slot, s.description, s.label))}
        </>
      )}

      <h2 style={sectionTitle}>Global</h2>
      {KNOWN_SLOTS.filter((s) => s.group === 'global').map((s) =>
        editor(s.slot, s.description, s.label),
      )}
    </div>
  )
}
