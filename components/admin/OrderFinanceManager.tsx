'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FINANCE_LINE_KINDS, LINE_KIND_LABEL, PERSON_LABEL, sheetTotals } from '@/lib/finance'
import type { FinanceLineKind, FinancePaidTo } from '@prisma/client'

type Line = {
  id: string
  kind: FinanceLineKind
  costPrice: number
  sellingPrice: number
}

type DraftLine = {
  key: string
  kind: FinanceLineKind
  costPrice: string
  sellingPrice: string
}

type Sheet = {
  id: string
  orderId: string
  customerPaidTo: FinancePaidTo
  lines: Line[]
  order?: { contactName: string; grandTotal: number }
}

type Hit = {
  id: string
  contactName: string
  contactPhone: string
  grandTotal: number
  status: string
  hasSheet: boolean
}

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  padding: '8px 10px',
  fontSize: '0.8125rem',
}

function newDraft(kind: FinanceLineKind = 'GOLD'): DraftLine {
  return { key: `${Date.now()}-${Math.random().toString(16).slice(2)}`, kind, costPrice: '', sellingPrice: '' }
}

export function OrderFinanceManager({ initial }: { initial: Sheet[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [orderId, setOrderId] = useState('')
  const [orderLabel, setOrderLabel] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [customerPaidTo, setCustomerPaidTo] = useState<FinancePaidTo>('VAIRIS_BANK')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const parsedLines = lines.map((l) => ({
    kind: l.kind,
    costPrice: Number(l.costPrice) || 0,
    sellingPrice: Number(l.sellingPrice) || 0,
  }))
  const totals = sheetTotals(parsedLines)

  function setLine(key: string, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  async function search(q: string) {
    setQuery(q)
    if (q.trim().length < 2) {
      setHits([])
      return
    }
    const res = await fetch(`/api/admin/finance/order-search?q=${encodeURIComponent(q.trim())}`)
    if (res.ok) setHits(await res.json())
  }

  function pick(h: Hit) {
    setOrderId(h.id)
    setOrderLabel(`${h.contactName || h.id} · ₹${h.grandTotal.toLocaleString('en-IN')}`)
    setHits([])
    setQuery(h.contactName || h.id)
    const existing = rows.find((r) => r.orderId === h.id)
    if (existing) {
      setLines(
        existing.lines.map((l) => ({
          key: l.id,
          kind: l.kind,
          costPrice: String(l.costPrice),
          sellingPrice: String(l.sellingPrice),
        })),
      )
      setCustomerPaidTo(existing.customerPaidTo)
    } else {
      setLines([])
    }
  }

  function load(row: Sheet) {
    setOrderId(row.orderId)
    setOrderLabel(row.order?.contactName || row.orderId)
    setQuery(row.order?.contactName || row.orderId)
    setLines(
      row.lines.map((l) => ({
        key: l.id,
        kind: l.kind,
        costPrice: String(l.costPrice),
        sellingPrice: String(l.sellingPrice),
      })),
    )
    setCustomerPaidTo(row.customerPaidTo)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!orderId) {
      setError('Pick an order')
      return
    }
    if (lines.length === 0) {
      setError('Add at least one line')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/finance/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          customerPaidTo,
          lines: parsedLines,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Save failed')
        return
      }
      setRows((rs) => {
        const rest = rs.filter((r) => r.orderId !== json.orderId)
        return [json, ...rest]
      })
      if (json.lines) {
        setLines(
          json.lines.map((l: Line) => ({
            key: l.id,
            kind: l.kind,
            costPrice: String(l.costPrice),
            sellingPrice: String(l.sellingPrice),
          })),
        )
      }
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const paidToOptions = useMemo(
    () =>
      [
        ['VAIRIS_BANK', 'Vairis bank'],
        ['ANIL', PERSON_LABEL.ANIL],
        ['SURYA', PERSON_LABEL.SURYA],
        ['VASU', PERSON_LABEL.VASU],
      ] as const,
    [],
  )

  return (
    <div>
      <form onSubmit={save} style={{ background: '#fff', border: '1px solid #e5e7eb', padding: 16, marginBottom: 20 }}>
        <strong style={{ fontSize: '0.875rem' }}>Order finance sheet</strong>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '4px 0 12px' }}>
          One sheet per order. Find an existing order or create a new order to attach a finance sheet. Saving overwrites. Each line has its own cost and selling price.
        </p>
        {error && <p style={{ color: '#b91c1c', fontSize: '0.8125rem' }}>{error}</p>}
        
        <div>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem', fontWeight: 500 }}>
            Find order or create order (name, phone, email, id)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...input, flex: 1 }}
              placeholder="Search by customer name, phone, email or order ID..."
              value={query}
              onChange={(e) => void search(e.target.value)}
            />
            <Link
              href="/admin/orders/new"
              className="admin-btn"
              style={{
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 14px',
                fontSize: '0.75rem',
                textDecoration: 'none',
              }}
            >
              Create order
            </Link>
          </div>
        </div>
        {hits.length > 0 && (
          <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', background: '#fff' }}>
            {hits.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => pick(h)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  fontSize: '0.8125rem',
                  background: '#fff',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                }}
              >
                {h.contactName || h.id} · {h.status} · ₹{h.grandTotal.toLocaleString('en-IN')}
                {h.hasSheet ? ' · sheet exists' : ''}
              </button>
            ))}
            <div
              style={{
                padding: '8px 10px',
                background: '#f9fafb',
                fontSize: '0.75rem',
                color: '#6b7280',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>Can&apos;t find the order?</span>
              <Link href="/admin/orders/new" style={{ color: '#032b24', fontWeight: 600, textDecoration: 'underline' }}>
                + Create new order
              </Link>
            </div>
          </div>
        )}
        {query.trim().length >= 2 && hits.length === 0 && !orderId && (
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderTop: 'none',
              padding: '10px',
              background: '#f9fafb',
              fontSize: '0.8125rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#6b7280' }}>No matching orders found.</span>
            <Link
              href="/admin/orders/new"
              className="admin-btn"
              style={{ fontSize: '0.7rem', padding: '4px 10px', textDecoration: 'none' }}
            >
              + Create order
            </Link>
          </div>
        )}
        {orderId && (
          <p style={{ fontSize: '0.8125rem', color: '#15803d', marginTop: 8 }}>
            ✓ {orderLabel} ({orderId.slice(0, 8)}…)
          </p>
        )}

        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 1.4fr) 1fr 1fr 40px',
              gap: 8,
              fontSize: '0.75rem',
              color: '#6b7280',
              marginBottom: 6,
            }}
          >
            <span>Line</span>
            <span>Cost price</span>
            <span>Selling price</span>
            <span />
          </div>
          {lines.map((l) => (
            <div
              key={l.key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 1.4fr) 1fr 1fr 40px',
                gap: 8,
                marginBottom: 8,
                alignItems: 'center',
              }}
            >
              <select
                style={input}
                value={l.kind}
                onChange={(e) => setLine(l.key, { kind: e.target.value as FinanceLineKind })}
              >
                {FINANCE_LINE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LINE_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <input
                style={input}
                type="number"
                min="0"
                step="0.01"
                value={l.costPrice}
                onChange={(e) => setLine(l.key, { costPrice: e.target.value })}
                required
              />
              <input
                style={input}
                type="number"
                min="0"
                step="0.01"
                value={l.sellingPrice}
                onChange={(e) => setLine(l.key, { sellingPrice: e.target.value })}
                required
              />
              <button
                type="button"
                className="admin-btn"
                aria-label="Remove line"
                onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                style={{ padding: '8px 0' }}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="admin-btn" onClick={() => setLines((ls) => [...ls, newDraft()])}>
            + Add line
          </button>
        </div>

        <p style={{ fontSize: '0.875rem' }}>
          CP ₹{totals.cost.toLocaleString('en-IN')} · SP ₹{totals.selling.toLocaleString('en-IN')} · Profit ₹
          {totals.profit.toLocaleString('en-IN')}
        </p>
        <label>
          Customer paid to
          <select style={input} value={customerPaidTo} onChange={(e) => setCustomerPaidTo(e.target.value as FinancePaidTo)}>
            {paidToOptions.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="admin-btn" style={{ marginTop: 14 }} disabled={saving}>
          {saving ? 'Saving…' : 'Save sheet'}
        </button>
      </form>

      <table className="admin-products" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 10 }}>Order</th>
            <th style={{ textAlign: 'right', padding: 10 }}>CP</th>
            <th style={{ textAlign: 'right', padding: 10 }}>SP</th>
            <th style={{ textAlign: 'right', padding: 10 }}>Profit</th>
            <th style={{ textAlign: 'left', padding: 10 }}>Paid to</th>
            <th style={{ padding: 10 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 16, color: '#6b7280' }}>
                No order sheets yet.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const t = sheetTotals(r.lines ?? [])
            return (
              <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td style={{ padding: 10 }}>{r.order?.contactName || r.orderId.slice(0, 8)}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>₹{t.cost.toLocaleString('en-IN')}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>₹{t.selling.toLocaleString('en-IN')}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>₹{t.profit.toLocaleString('en-IN')}</td>
                <td style={{ padding: 10 }}>
                  {r.customerPaidTo === 'VAIRIS_BANK' ? 'Vairis bank' : PERSON_LABEL[r.customerPaidTo]}
                </td>
                <td style={{ padding: 10 }}>
                  <button type="button" className="admin-btn" onClick={() => load(r)}>
                    Edit
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
