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
  let rows: Awaited<ReturnType<typeof prisma.siteBanner.findMany>> = []
  let dbMissing = false

  try {
    rows = await prisma.siteBanner.findMany()
  } catch (err) {
    // Cloud / stage DB without migration 20260710000000_order_flow_deposit_banners
    console.error('[admin/content] SiteBanner query failed', err)
    dbMissing = true
  }

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
          <strong>Database migration required.</strong> Table <code>SiteBanner</code> is missing.
          Run this in Supabase SQL Editor, then reload:
          <pre
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              background: '#fffbeb',
              overflow: 'auto',
              fontSize: '0.75rem',
            }}
          >{`CREATE TABLE IF NOT EXISTS "SiteBanner" (
  "id" TEXT NOT NULL,
  "slot" TEXT NOT NULL,
  "title" TEXT,
  "subtitle" TEXT,
  "imageUrl" TEXT,
  "linkUrl" TEXT,
  "ctaLabel" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteBanner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SiteBanner_slot_key" ON "SiteBanner"("slot");`}</pre>
        </div>
      )}

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
