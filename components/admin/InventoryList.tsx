'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { inventoryDisplayName } from '@/lib/inventory'
import { InventorySubnav } from '@/components/admin/InventorySubnav'
import { InventoryMarkSoldDialog } from '@/components/admin/InventoryMarkSoldDialog'
import { effectiveInventorySoldPrice, effectiveInventoryHeaderPrice } from '@/lib/inventory-pricing'
import { shortFinanceId } from '@/lib/finance'

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export type InventorySaleRef = {
  qty: number
  soldAt: string
  orderId: string | null
  unlinkedOrderLabel: string | null
  order: { id: string; contactName: string } | null
}

export type InventoryListBillRef = {
  id: string
  billNumber: string
  supplierName: string
  href: string | null
}

export type InventoryListRow = {
  id: string
  qtyOnHand: number
  qtySold: number
  purchasePrice: number | null
  soldPrice: number | null
  potentialPrice: number | null
  liveSoldPrice?: number | null
  latestSale: InventorySaleRef | null
  customName: string | null
  updatedAt: string
  holder: { id: string; name: string }
  product: { id: string; name: string; itemCode: string | null } | null
  variant: { id: string; sku: string; metalType: string; size: string | null } | null
  purchaseBills?: InventoryListBillRef[]
  _count?: { allocations: number }
}

function saleRefLabel(sale: InventorySaleRef): React.ReactNode {
  if (sale.order) {
    return (
      <Link href={`/admin/orders/${sale.order.id}`} style={{ color: '#032b24' }}>
        {sale.order.contactName} ({shortFinanceId(sale.order.id)})
      </Link>
    )
  }
  if (sale.unlinkedOrderLabel) {
    return (
      <span title="Not linked to order">
        {sale.unlinkedOrderLabel}{' '}
        <span style={{ color: '#9ca3af', fontSize: '0.6875rem' }}>(not linked)</span>
      </span>
    )
  }
  return '—'
}

function billChipLabel(b: InventoryListBillRef) {
  const num = b.billNumber.trim() || shortFinanceId(b.id)
  return `#${num}`
}

export function InventoryList({
  initialRows,
  holders,
  isFinance = false,
}: {
  initialRows: InventoryListRow[]
  holders: { id: string; name: string }[]
  isFinance?: boolean
}) {
  const [q, setQ] = useState('')
  const [holderId, setHolderId] = useState('')
  const [linked, setLinked] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [stock, setStock] = useState<'all' | 'in_stock' | 'sold_out'>('all')
  const [markSold, setMarkSold] = useState<InventoryListRow | null>(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return initialRows.filter((r) => {
      if (holderId && r.holder.id !== holderId) return false
      if (linked === 'linked' && !r.variant) return false
      if (linked === 'unlinked' && r.variant) return false
      if (stock === 'in_stock' && r.qtyOnHand <= 0) return false
      if (stock === 'sold_out' && r.qtyOnHand > 0) return false
      if (!needle) return true
      const hay = [
        r.customName,
        r.product?.name,
        r.product?.itemCode,
        r.variant?.sku,
        r.holder.name,
        r.latestSale?.order?.contactName,
        r.latestSale?.unlinkedOrderLabel,
        ...(r.purchaseBills ?? []).map((b) => b.billNumber),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [initialRows, q, holderId, linked, stock])

  const totalInventoryValue = useMemo(() => {
    if (!isFinance) return 0
    const liveByVariantId = Object.fromEntries(
      rows
        .filter((r) => r.variant?.id && r.liveSoldPrice != null)
        .map((r) => [r.variant!.id, r.liveSoldPrice!]),
    )
    return rows.reduce((sum, r) => {
      if (r.qtyOnHand <= 0) return sum
      const unit = effectiveInventoryHeaderPrice(
        r.potentialPrice,
        r.purchasePrice,
        r.variant?.id ?? null,
        liveByVariantId,
      )
      if (unit == null) return sum
      return sum + r.qtyOnHand * unit
    }, 0)
  }, [rows, isFinance])

  const valuedRowCount = useMemo(() => {
    if (!isFinance) return 0
    const liveByVariantId = Object.fromEntries(
      rows
        .filter((r) => r.variant?.id && r.liveSoldPrice != null)
        .map((r) => [r.variant!.id, r.liveSoldPrice!]),
    )
    return rows.filter((r) => {
      if (r.qtyOnHand <= 0) return false
      return (
        effectiveInventoryHeaderPrice(
          r.potentialPrice,
          r.purchasePrice,
          r.variant?.id ?? null,
          liveByVariantId,
        ) != null
      )
    }).length
  }, [rows, isFinance])

  const colSpan = isFinance ? 10 : 8

  return (
    <>
      <InventorySubnav />

      {isFinance ? (
        <div className="inv-kpi">
          <div className="inv-kpi__card">
            <div className="inv-kpi__label">Total inventory value</div>
            <div className="inv-kpi__value">{inr(totalInventoryValue)}</div>
            <div className="inv-kpi__meta">
              {valuedRowCount > 0
                ? `${valuedRowCount} in-stock line${valuedRowCount === 1 ? '' : 's'} · potential → live → purchase`
                : rows.length > 0
                  ? 'Add potential, live catalogue, or purchase price on in-stock items'
                  : 'No stock lines in current view'}
            </div>
          </div>
        </div>
      ) : null}

      <div className="inv-toolbar">
        <div className="inv-field">
          <label htmlFor="inv-search">Search</label>
          <input
            id="inv-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, SKU, order ref…"
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
        <div className="inv-field" style={{ maxWidth: 140 }}>
          <label htmlFor="inv-stock">Stock</label>
          <select id="inv-stock" value={stock} onChange={(e) => setStock(e.target.value as typeof stock)}>
            <option value="all">All</option>
            <option value="in_stock">In stock</option>
            <option value="sold_out">Sold out</option>
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
              <th>Status</th>
              <th>Qty</th>
              {isFinance ? <th>Purchase / pc</th> : null}
              <th>Sold / pc</th>
              {isFinance ? <th>Purchase total</th> : null}
              <th>Bills</th>
              <th>Sold to</th>
              <th>Holder</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} style={{ color: '#9ca3af', padding: 20 }}>
                  No inventory lines match.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const liveByVariant =
                  r.variant?.id && r.liveSoldPrice != null ? { [r.variant.id]: r.liveSoldPrice } : {}
                const effectiveSold = effectiveInventorySoldPrice(
                  r.soldPrice,
                  r.variant?.id ?? null,
                  liveByVariant,
                )
                const isLiveSold = r.soldPrice == null && r.liveSoldPrice != null
                const soldOut = r.qtyOnHand <= 0
                const bills = r.purchaseBills ?? []
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{inventoryDisplayName(r)}</div>
                      {r.product?.itemCode && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{r.product.itemCode}</div>
                      )}
                    </td>
                    <td>
                      {soldOut ? (
                        <span className="inv-badge inv-badge--sold">Sold out</span>
                      ) : (
                        <span className="inv-badge inv-badge--instock">In stock</span>
                      )}
                      {r.qtySold > 0 && (
                        <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: 4 }}>
                          {r.qtySold} sold
                        </div>
                      )}
                    </td>
                    <td>{r.qtyOnHand}</td>
                    {isFinance ? (
                      <td style={{ color: '#6b7280' }}>
                        {r.purchasePrice != null ? inr(r.purchasePrice) : '—'}
                      </td>
                    ) : null}
                    <td style={{ color: '#6b7280' }}>
                      {effectiveSold != null ? (
                        <>
                          {inr(effectiveSold)}
                          {isLiveSold && (
                            <span style={{ display: 'block', fontSize: '0.6875rem', color: '#9ca3af' }}>
                              live
                            </span>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    {isFinance ? (
                      <td style={{ fontWeight: 600 }}>
                        {r.purchasePrice != null && r.qtyOnHand > 0
                          ? inr(r.qtyOnHand * r.purchasePrice)
                          : '—'}
                      </td>
                    ) : null}
                    <td style={{ fontSize: '0.75rem', maxWidth: 140 }}>
                      {bills.length === 0
                        ? '—'
                        : bills.map((b, i) => (
                            <span key={b.id}>
                              {i > 0 ? ', ' : null}
                              {b.href ? (
                                <Link href={b.href} style={{ color: '#032b24', fontWeight: 500 }}>
                                  {billChipLabel(b)}
                                </Link>
                              ) : (
                                billChipLabel(b)
                              )}
                            </span>
                          ))}
                    </td>
                    <td style={{ fontSize: '0.8125rem', maxWidth: 160 }}>
                      {r.latestSale ? saleRefLabel(r.latestSale) : '—'}
                    </td>
                    <td>{r.holder.name}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link href={`/admin/inventory/${r.id}`} style={{ marginRight: 10 }}>
                        Edit
                      </Link>
                      {r.qtyOnHand > 0 && (
                        <button
                          type="button"
                          className="inv-link-btn"
                          onClick={() => setMarkSold(r)}
                        >
                          Mark sold
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {markSold && (
        <InventoryMarkSoldDialog
          itemId={markSold.id}
          itemLabel={inventoryDisplayName(markSold)}
          qtyOnHand={markSold.qtyOnHand}
          open
          onClose={() => setMarkSold(null)}
        />
      )}
    </>
  )
}
