'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { inventoryDisplayName } from '@/lib/inventory'
import { InventorySubnav } from '@/components/admin/InventorySubnav'

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export type InventoryListRow = {
  id: string
  qtyOnHand: number
  unitPrice: number | null
  liveUnitPrice?: number | null
  customName: string | null
  updatedAt: string
  holder: { id: string; name: string }
  product: { id: string; name: string; itemCode: string | null } | null
  variant: { id: string; sku: string; metalType: string; size: string | null } | null
  _count?: { allocations: number }
}

export function InventoryList({
  initialRows,
  holders,
}: {
  initialRows: InventoryListRow[]
  holders: { id: string; name: string }[]
}) {
  const [q, setQ] = useState('')
  const [holderId, setHolderId] = useState('')
  const [linked, setLinked] = useState<'all' | 'linked' | 'unlinked'>('all')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return initialRows.filter((r) => {
      if (holderId && r.holder.id !== holderId) return false
      if (linked === 'linked' && !r.variant) return false
      if (linked === 'unlinked' && r.variant) return false
      if (!needle) return true
      const hay = [
        r.customName,
        r.product?.name,
        r.product?.itemCode,
        r.variant?.sku,
        r.holder.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [initialRows, q, holderId, linked])

  const totalValue = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const price = r.unitPrice ?? r.liveUnitPrice ?? null
        if (price == null) return sum
        return sum + r.qtyOnHand * price
      }, 0),
    [rows],
  )

  const pricedRowCount = useMemo(
    () => rows.filter((r) => (r.unitPrice ?? r.liveUnitPrice) != null).length,
    [rows],
  )

  return (
    <>
      <InventorySubnav />

      <div className="inv-kpi">
        <div className="inv-kpi__card">
          <div className="inv-kpi__label">Total inventory value</div>
          <div className="inv-kpi__value">{inr(totalValue)}</div>
          <div className="inv-kpi__meta">
            {pricedRowCount > 0
              ? `${pricedRowCount} priced line${pricedRowCount === 1 ? '' : 's'} in current view`
              : rows.length > 0
                ? 'Add price per piece on custom items to see value'
                : 'No stock lines in current view'}
          </div>
        </div>
      </div>

      <div className="inv-toolbar">
        <div className="inv-field">
          <label htmlFor="inv-search">Search</label>
          <input
            id="inv-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, SKU, item code…"
          />
        </div>
        <div className="inv-field" style={{ maxWidth: 200 }}>
          <label htmlFor="inv-holder">Holder</label>
          <select id="inv-holder" value={holderId} onChange={(e) => setHolderId(e.target.value)}>
            <option value="">All holders</option>
            {holders.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <div className="inv-field" style={{ maxWidth: 180 }}>
          <label htmlFor="inv-linked">Catalogue</label>
          <select
            id="inv-linked"
            value={linked}
            onChange={(e) => setLinked(e.target.value as typeof linked)}
          >
            <option value="all">All</option>
            <option value="linked">Linked</option>
            <option value="unlinked">Unlinked</option>
          </select>
        </div>
        <Link href="/admin/inventory/new" className="admin-btn" style={{ marginBottom: 1 }}>
          + Add inventory
        </Link>
      </div>

      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price / pc</th>
              <th>Total</th>
              <th>Holder</th>
              <th>Catalogue</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ color: '#9ca3af', padding: 20 }}>
                  No inventory lines match.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const effectivePrice = r.unitPrice ?? r.liveUnitPrice ?? null
                const isLivePrice = r.unitPrice == null && r.liveUnitPrice != null
                return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inventoryDisplayName(r)}</div>
                    {r.product?.itemCode && (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{r.product.itemCode}</div>
                    )}
                  </td>
                  <td>{r.qtyOnHand}</td>
                  <td style={{ color: '#6b7280' }}>
                    {effectivePrice != null ? (
                      <>
                        {inr(effectivePrice)}
                        {isLivePrice && (
                          <span style={{ display: 'block', fontSize: '0.6875rem', color: '#9ca3af' }}>
                            live
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {effectivePrice != null ? inr(r.qtyOnHand * effectivePrice) : '—'}
                  </td>
                  <td>{r.holder.name}</td>
                  <td>
                    {r.variant ? (
                      <span className="inv-badge inv-badge--linked">Linked</span>
                    ) : (
                      <span className="inv-badge inv-badge--unlinked">Unlinked</span>
                    )}
                  </td>
                  <td style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    {new Date(r.updatedAt).toLocaleString('en-IN')}
                  </td>
                  <td>
                    <Link href={`/admin/inventory/${r.id}`}>Edit</Link>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
