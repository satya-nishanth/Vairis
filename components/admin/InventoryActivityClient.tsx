'use client'

import Link from 'next/link'
import { Fragment, useMemo, useState } from 'react'
import { InventorySubnav } from '@/components/admin/InventorySubnav'

export type InventoryAuditRow = {
  id: string
  createdAt: string
  actorEmail: string
  action: string
  entityType: string
  entityId: string | null
  objectLabel: string
  objectHref: string | null
  summary: string
  before: unknown
  after: unknown
}

const GREEN = '#032b24'
const BORDER = '#e5e7eb'
const MUTED = '#6b7280'

const ENTITY_LABEL: Record<string, string> = {
  ITEM: 'Stock line',
  HOLDER: 'Holder',
  ALLOCATION: 'Order allocation',
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  fontWeight: 600,
  fontSize: '0.6875rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: MUTED,
  borderBottom: `1px solid ${BORDER}`,
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: `1px solid ${BORDER}`,
  verticalAlign: 'top',
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function actionStyle(action: string): { background: string; color: string } {
  if (action === 'CREATE') return { background: '#dceee8', color: GREEN }
  if (action === 'DELETE') return { background: '#fce8e8', color: '#9f1239' }
  if (action === 'ALLOCATE') return { background: '#e0e7ff', color: '#3730a3' }
  return { background: '#fef3c7', color: '#92400e' }
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value == null) {
    return (
      <div style={{ fontSize: '0.75rem', color: MUTED }}>
        {label}: —
      </div>
    )
  }
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: MUTED, marginBottom: 4 }}>{label}</div>
      <pre
        style={{
          margin: 0,
          padding: 10,
          background: '#f9fafb',
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          fontSize: '0.6875rem',
          overflow: 'auto',
          maxHeight: 220,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

export function InventoryActivityClient({ initial }: { initial: InventoryAuditRow[] }) {
  const [query, setQuery] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initial.filter((r) => {
      if (entityFilter && r.entityType !== entityFilter) return false
      if (actionFilter && r.action !== actionFilter) return false
      if (!q) return true
      const hay = [
        r.actorEmail,
        r.summary,
        r.entityType,
        r.action,
        r.entityId ?? '',
        r.objectLabel,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [initial, query, entityFilter, actionFilter])

  const control: React.CSSProperties = {
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: '0.8125rem',
    background: '#fff',
  }

  return (
    <>
      <InventorySubnav />

      <p style={{ fontSize: '0.8125rem', color: MUTED, marginTop: 0, marginBottom: 14 }}>
        Append-only log of stock changes, holder edits, and order allocations.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <input
          type="search"
          placeholder="Search user, item, summary…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...control, minWidth: 200, flex: '1 1 180px' }}
          aria-label="Search activity log"
        />
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          style={{ ...control, minWidth: 140 }}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {Object.entries(ENTITY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{ ...control, minWidth: 120 }}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="ALLOCATE">Allocate</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: 10, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ background: '#f7f7f5', textAlign: 'left' }}>
              <th style={th}>When</th>
              <th style={th}>User</th>
              <th style={th}>Action</th>
              <th style={th}>Type</th>
              <th style={th}>Object</th>
              <th style={th}>Summary</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const open = openId === r.id
              const badge = actionStyle(r.action)
              return (
                <Fragment key={r.id}>
                  <tr style={{ background: '#fff' }}>
                    <td style={td}>{formatWhen(r.createdAt)}</td>
                    <td style={td}>{r.actorEmail}</td>
                    <td style={td}>
                      <span
                        style={{
                          display: 'inline-block',
                          borderRadius: 6,
                          padding: '2px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          ...badge,
                        }}
                      >
                        {r.action}
                      </span>
                    </td>
                    <td style={td}>{ENTITY_LABEL[r.entityType] ?? r.entityType}</td>
                    <td style={td}>
                      {r.objectHref ? (
                        <Link href={r.objectHref} style={{ color: GREEN, fontWeight: 500 }}>
                          {r.objectLabel || '—'}
                        </Link>
                      ) : (
                        r.objectLabel || '—'
                      )}
                    </td>
                    <td style={{ ...td, maxWidth: 320 }}>{r.summary}</td>
                    <td style={td}>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : r.id)}
                        className="admin-btn admin-btn--secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      >
                        {open ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={7} style={{ ...td, background: '#fafafa' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <JsonBlock label="Before" value={r.before} />
                          <JsonBlock label="After" value={r.after} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...td, textAlign: 'center', color: MUTED, padding: 24 }}>
                  {initial.length === 0
                    ? 'No inventory activity logged yet. Changes from here on will appear in this list.'
                    : 'No entries match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
