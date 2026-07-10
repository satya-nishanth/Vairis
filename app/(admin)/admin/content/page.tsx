import { prisma } from '@/lib/prisma'
import { KNOWN_SLOTS } from '@/lib/site-content'
import { ContentEditor } from './ContentEditor'

export const dynamic = 'force-dynamic'

/**
 * Admin site content — edit every customizable banner slot (see
 * lib/site-content.ts for how slots work and how to add new ones).
 * Storefront falls back to built-in copy for any slot that's empty or
 * switched off, so nothing here can break a page.
 */
export default async function AdminContentPage() {
  const rows = await prisma.siteBanner.findMany()
  const bySlot = Object.fromEntries(rows.map((r) => [r.slot, r]))

  return (
    <div style={{ padding: '1rem 2rem', maxWidth: 860 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Site Content
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        Customize banners and hero sections. Empty fields (or an inactive slot) fall back to the
        built-in design — you can&apos;t break the site from here.
      </p>

      {KNOWN_SLOTS.map(({ slot, description }) => {
        const row = bySlot[slot]
        return (
          <ContentEditor
            key={slot}
            slot={slot}
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
      })}
    </div>
  )
}
