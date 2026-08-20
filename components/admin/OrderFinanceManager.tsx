'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { orderCost, orderProfit, PERSON_LABEL } from '@/lib/finance'
import type { FinancePaidTo } from '@prisma/client'

type Sheet = {
  id: string
  orderId: string
  goldCost: number
  diamondCost: number
  stonesCost: number
  sellingPrice: number
  customerPaidTo: FinancePaidTo
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

export function OrderFinanceManager({ initial }: { initial: Sheet[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [orderId, setOrderId] = useState('')
  const [orderLabel, setOrderLabel] = useState('')
  const [goldCost, setGoldCost] = useState('')
  const [diamondCost, setDiamondCost] = useState('')
  const [stonesCost, setStonesCost] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [customerPaidTo, setCustomerPaidTo] = useState<FinancePaidTo>('VAIRIS_BANK')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const gold = Number(goldCost) || 0
  const diamond = Number(diamondCost) || 0
  const stones = Number(stonesCost) || 0
  const sp = Number(sellingPrice) || 0
  const cp = orderCost(gold, diamond, stones)
  const profit = orderProfit(sp, cp)

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
      setGoldCost(String(existing.goldCost))
      setDiamondCost(String(existing.diamondCost))
      setStonesCost(String(existing.stonesCost))
      setSellingPrice(String(existing.sellingPrice))
      setCustomerPaidTo(existing.customerPaidTo)
    } else {
      setSellingPrice(String(h.grandTotal))
    }
  }

  function load(row: Sheet) {
    setOrderId(row.orderId)
    setOrderLabel(row.order?.contactName || row.orderId)
    setGoldCost(String(row.goldCost))
    setDiamondCost(String(row.diamondCost))
    setStonesCost(String(row.stonesCost))
    setSellingPrice(String(row.sellingPrice))
    setCustomerPaidTo(row.customerPaidTo)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!orderId) {
      setError('Pick an order')
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
          goldCost: gold,
          diamondCost: diamond,
          stonesCost: stones,
          sellingPrice: sp,
          customerPaidTo,
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
        <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
          One sheet per order. Saving overwrites. Selling price is entered (not taken from store pricing).
        </p>
        {error && <p style={{ color: '#b91c1c', fontSize: '0.8125rem' }}>{error}</p>}
        <label>
          Find order (name, phone, email, id)
          <input style={input} value={query} onChange={(e) => void search(e.target.value)} />
        </label>
        {hits.length > 0 && (
          <div style={{ border: '1px solid #e5e7eb', borderTop: 'none' }}>
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
          </div>
        )}
        {orderId && (
          <p style={{ fontSize: '0.8125rem', color: '#15803d' }}>
            ✓ {orderLabel} ({orderId.slice(0, 8)}…)
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <label>
            Gold cost
            <input style={input} type="number" min="0" step="0.01" value={goldCost} onChange={(e) => setGoldCost(e.target.value)} required />
          </label>
          <label>
            Diamond (our price)
            <input style={input} type="number" min="0" step="0.01" value={diamondCost} onChange={(e) => setDiamondCost(e.target.value)} required />
          </label>
          <label>
            Stones price
            <input style={input} type="number" min="0" step="0.01" value={stonesCost} onChange={(e) => setStonesCost(e.target.value)} required />
          </label>
          <label>
            Selling price
            <input style={input} type="number" min="0" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} required />
          </label>
        </div>
        <p style={{ fontSize: '0.875rem' }}>
          CP ₹{cp.toLocaleString('en-IN')} · Profit ₹{profit.toLocaleString('en-IN')}
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
            const c = orderCost(r.goldCost, r.diamondCost, r.stonesCost)
            return (
              <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                <td style={{ padding: 10 }}>{r.order?.contactName || r.orderId.slice(0, 8)}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>₹{c.toLocaleString('en-IN')}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>₹{r.sellingPrice.toLocaleString('en-IN')}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>
                  ₹{orderProfit(r.sellingPrice, c).toLocaleString('en-IN')}
                </td>
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
