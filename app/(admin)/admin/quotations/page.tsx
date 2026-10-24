import Link from 'next/link'
import type { QuotationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AdminGuide } from '@/components/admin/AdminGuide'

export const dynamic = 'force-dynamic'

const FILTERS: (QuotationStatus | 'ALL')[] = [
  'ALL',
  'REQUESTED',
  'QUOTED',
  'ACCEPTED',
  'CONVERTED',
  'CANCELLED',
]
const STALE_QUOTED_HOURS = Number(process.env.QUOTE_STALE_QUOTED_HOURS ?? 24)

type QuotationRow = Awaited<ReturnType<typeof loadQuotations>>[number]

function formatAge(from: Date): string {
  const ms = Date.now() - from.getTime()
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function isFlagged(q: { status: QuotationStatus; escalatedAt: Date | null; quotedAt: Date | null }): boolean {
  if (q.status === 'REQUESTED') return q.escalatedAt != null
  if (q.status === 'QUOTED') {
    return q.quotedAt != null && Date.now() - q.quotedAt.getTime() > STALE_QUOTED_HOURS * 60 * 60 * 1000
  }
  return false
}

async function loadQuotations(filter: QuotationStatus | null, attention: boolean) {
  const staleThreshold = new Date(Date.now() - STALE_QUOTED_HOURS * 60 * 60 * 1000)
  const where = attention
    ? {
        OR: [
          { status: 'REQUESTED' as const, escalatedAt: { not: null } },
          { status: 'QUOTED' as const, quotedAt: { lt: staleThreshold } },
        ],
      }
    : filter
      ? { status: filter }
      : undefined

  return prisma.quotation.findMany({
    where,
    orderBy: filter === 'QUOTED' ? { quotedAt: 'asc' } : { createdAt: 'asc' },
    take: 200,
  })
}

/** Admin quotation list — filter chips per status + a dedicated attention filter, oldest first. */
export default async function AdminQuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; attention?: string }>
}) {
  const { status, attention: attentionParam } = await searchParams
  const filter = FILTERS.includes(status as QuotationStatus) ? (status as QuotationStatus) : null
  const attention = attentionParam === 'true'

  const quotations: QuotationRow[] = await loadQuotations(filter, attention)

  return (
    <div className="admin-page admin-page--quotations">
      <div className="admin-page__header">
        <h1 className="admin-page__title" style={{ marginBottom: 0 }}>Quotations</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            href="/admin/quotations/settings"
            className="admin-btn"
            style={{ background: '#fff', color: '#032b24', border: '1px solid #032b24' }}
          >
            Settings
          </Link>
          <Link href="/admin/quotations/new" className="admin-btn">
            + New Quotation
          </Link>
        </div>
      </div>
      <AdminGuide
        pageKey="quotations"
        title="Quotations"
        blurb="Admin quote desk: build Cost Estimator versions, mark quoted, record customer response, then convert when ACCEPTED. Discord is secondary notify only."
        tips={['Rows flagged red/amber have been escalated (REQUESTED) or sat QUOTED too long — check the Attention filter. Convert requires ACCEPTED.']}
      />

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {FILTERS.map((f) => {
          const active = !attention && ((f === 'ALL' && !filter) || f === filter)
          return (
            <Link
              key={f}
              href={f === 'ALL' ? '/admin/quotations' : `/admin/quotations?status=${f}`}
              style={{
                fontSize: '0.6875rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '6px 12px',
                borderRadius: '999px',
                textDecoration: 'none',
                border: '1px solid',
                borderColor: active ? '#032b24' : '#e5e7eb',
                background: active ? '#032b24' : '#fff',
                color: active ? '#fff' : '#4b5563',
              }}
            >
              {f === 'ALL' ? 'All' : f}
            </Link>
          )
        })}
        <Link
          href="/admin/quotations?attention=true"
          style={{
            fontSize: '0.6875rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            borderRadius: '999px',
            textDecoration: 'none',
            border: '1px solid',
            borderColor: attention ? '#b91c1c' : '#fecaca',
            background: attention ? '#b91c1c' : '#fef2f2',
            color: attention ? '#fff' : '#b91c1c',
          }}
        >
          Needs Attention
        </Link>
      </div>

      {quotations.length === 0 ? (
        <p style={{ color: '#6b7280', padding: '2rem 0' }}>
          No quotations{attention ? ' need attention' : filter ? ` in ${filter}` : ' yet'}.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', background: '#fff', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: '10px 12px' }}>Ref</th>
                <th style={{ padding: '10px 12px' }}>Type</th>
                <th style={{ padding: '10px 12px' }}>Customer</th>
                <th style={{ padding: '10px 12px' }}>Age</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => {
                const flagged = isFlagged(q)
                const age = q.status === 'QUOTED' && q.quotedAt ? q.quotedAt : q.createdAt
                return (
                  <tr
                    key={q.id}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: flagged ? '#fef2f2' : undefined,
                    }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <Link href={`/admin/quotations/${q.id}`} style={{ color: '#032b24', fontWeight: 600 }}>
                        {q.displayId}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{q.orderType}</td>
                    <td style={{ padding: '10px 12px' }}>{q.customerName || '—'}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {formatAge(age)}
                      {flagged && <span style={{ marginLeft: 6, color: '#b91c1c' }}>⚠</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{q.status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
