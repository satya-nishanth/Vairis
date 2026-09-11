'use client'

import Link from 'next/link'
import { Fragment, useMemo, useState } from 'react'
import { shortFinanceId } from '@/lib/finance'

export type FinanceAuditRow = {
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
  TRANSACTION: 'Transaction',
  ORDER_SHEET: 'Order sheet',
  PURCHASE_BILL: 'Purchase bill',
  ACCOUNT: 'Account',
  CONTACT: 'Contact',
  CATEGORY: 'Category',
  EXPENSE: 'Expense',
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

/** Fallback for rows logged before objectLabel existed. */
function resolveObject(r: FinanceAuditRow): { label: string; href: string | null } {
  if (r.objectLabel?.trim()) {
    return { label: r.objectLabel.trim(), href: r.objectHref }
  }
  const snap = (r.after ?? r.before) as Record<string, unknown> | null
  if (!snap || typeof snap !== 'object') {
    return { label: r.entityId ? shortFinanceId(r.entityId) : '—', href: r.objectHref }
  }
  if (r.entityType === 'TRANSACTION') {
    const id = String(snap.id || r.entityId || '')
    const amount = typeof snap.amount === 'number' ? snap.amount : null
    const short = id ? shortFinanceId(id) : '—'
    const label = amount != null ? `${short} · ₹${amount.toLocaleString('en-IN')}` : short
    const href = id ? `/admin/finance/transactions?edit=${id}` : r.objectHref
    return { label: label || '—', href }
  }
  if (r.entityType === 'ORDER_SHEET') {
    const orderId = String(snap.orderId || r.entityId || '')
    const label = orderId ? shortFinanceId(orderId) : '—'
    const href = orderId ? `/admin/finance/orders?orderId=${encodeURIComponent(orderId)}` : r.objectHref
    return { label, href }
  }
  if (r.entityType === 'PURCHASE_BILL') {
    const id = String(snap.id || r.entityId || '')
    const billNumber = typeof snap.billNumber === 'string' ? snap.billNumber.trim() : ''
    const label = billNumber ? `#${billNumber}` : id ? shortFinanceId(id) : '—'
    const href = id ? `/admin/finance/purchase-bills?edit=${encodeURIComponent(id)}` : r.objectHref
    return { label, href }
  }
  if (typeof snap.name === 'string' && snap.name.trim()) {
    return { label: snap.name.trim(), href: r.objectHref ?? '/admin/finance/config' }
  }
  if (typeof snap.description === 'string' && snap.description.trim()) {
    return { label: snap.description.trim().slice(0, 80), href: r.objectHref }
  }
  return { label: r.entityId ? shortFinanceId(r.entityId) : '—', href: r.objectHref }
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

export function FinanceAuditClient({ initial }: { initial: FinanceAuditRow[] }) {
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
        resolveObject(r).label,
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
    <div>
      <p style={{ fontSize: '0.8125rem', color: MUTED, marginTop: 0, marginBottom: 14 }}>
        Append-only log of creates, edits, and removals across Finance (transactions, order sheets,
        config, expenses).
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <input
          type="search"
          placeholder="Search actor, object, summary…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...control, minWidth: 200, flex: '1 1 180px' }}
          aria-label="Search audit log"
        />
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          style={{ ...control, minWidth: 140 }}
          aria-label="Filter by entity"
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
              const obj = resolveObject(r)
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
                          background:
                            r.action === 'CREATE'
                              ? '#dceee8'
                              : r.action === 'DELETE'
                                ? '#fce8e8'
                                : '#fef3c7',
                          color:
                            r.action === 'CREATE'
                              ? GREEN
                              : r.action === 'DELETE'
                                ? '#9f1239'
                                : '#92400e',
                        }}
                      >
                        {r.action}
                      </span>
                    </td>
                    <td style={td}>{ENTITY_LABEL[r.entityType] ?? r.entityType}</td>
                    <td style={{ ...td, maxWidth: 220, fontWeight: 500 }}>
                      {obj.href ? (
                        <Link
                          href={obj.href}
                          style={{ color: GREEN, textDecoration: 'underline' }}
                        >
                          {obj.label}
                        </Link>
                      ) : (
                        obj.label
                      )}
                    </td>
                    <td style={{ ...td, maxWidth: 360 }}>{r.summary}</td>
                    <td style={td}>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : r.id)}
                        style={{
                          border: `1px solid ${BORDER}`,
                          borderRadius: 8,
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          background: '#fff',
                          cursor: 'pointer',
                          color: '#374151',
                        }}
                      >
                        {open ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={7} style={{ padding: '0 14px 14px', background: '#fcfcfb' }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 12,
                            paddingTop: 4,
                          }}
                        >
                          <JsonBlock label="Before" value={r.before} />
                          <JsonBlock label="After" value={r.after} />
                        </div>
                        {r.entityId && (
                          <div style={{ marginTop: 8, fontSize: '0.6875rem', color: MUTED }}>
                            Entity id: {r.entityId}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: MUTED }}>
                  {initial.length === 0
                    ? 'No finance activity logged yet. Changes from here on will appear in this list.'
                    : 'No entries match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: MUTED,
  borderBottom: `1px solid ${BORDER}`,
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'middle',
  color: '#111827',
}
