'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { inventoryDisplayName } from '@/lib/inventory'
import { InventorySubnav } from '@/components/admin/InventorySubnav'
import { InventoryMarkSoldDialog } from '@/components/admin/InventoryMarkSoldDialog'
import { shortFinanceId } from '@/lib/finance'

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const fmtGrams = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? '—' : `${n.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g`

const fmtCarats = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? '—' : `${n.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ct`

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
  weightGrams: number | null
  diamondCarats: number | null
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

type InvSortKey =
  | 'name'
  | 'status'
  | 'qty'
  | 'weight'
  | 'diamond'
  | 'purchaseTotal'
  | 'bills'
  | 'soldTo'
  | 'holder'

type SortDir = 'asc' | 'desc'

function cmpStr(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
}

function cmpNum(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a - b
}

function soldToSortLabel(sale: InventorySaleRef | null): string {
  if (!sale) return ''
  if (sale.order?.contactName) return sale.order.contactName
  if (sale.unlinkedOrderLabel) return sale.unlinkedOrderLabel
  return ''
}

function compareInvRows(a: InventoryListRow, b: InventoryListRow, key: InvSortKey): number {
  switch (key) {
    case 'name':
      return cmpStr(inventoryDisplayName(a), inventoryDisplayName(b))
    case 'status':
      return cmpNum(a.qtyOnHand > 0 ? 1 : 0, b.qtyOnHand > 0 ? 1 : 0)
    case 'qty':
      return cmpNum(a.qtyOnHand, b.qtyOnHand)
    case 'weight':
      return cmpNum(a.weightGrams, b.weightGrams)
    case 'diamond':
      return cmpNum(a.diamondCarats, b.diamondCarats)
    case 'purchaseTotal': {
      const ta = a.purchasePrice != null && a.qtyOnHand > 0 ? a.qtyOnHand * a.purchasePrice : null
      const tb = b.purchasePrice != null && b.qtyOnHand > 0 ? b.qtyOnHand * b.purchasePrice : null
      return cmpNum(ta, tb)
    }
    case 'bills':
      return cmpNum(a.purchaseBills?.length ?? 0, b.purchaseBills?.length ?? 0)
    case 'soldTo':
      return cmpStr(soldToSortLabel(a.latestSale), soldToSortLabel(b.latestSale))
    case 'holder':
      return cmpStr(a.holder.name, b.holder.name)
  }
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
  const [sortKey, setSortKey] = useState<InvSortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [markSold, setMarkSold] = useState<InventoryListRow | null>(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = initialRows.filter((r) => {
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
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const cmp = compareInvRows(a, b, sortKey)
      if (cmp !== 0) return cmp * dir
      return cmpStr(inventoryDisplayName(a), inventoryDisplayName(b))
    })
  }, [initialRows, q, holderId, linked, stock, sortKey, sortDir])

  const inStock = useMemo(() => rows.filter((r) => r.qtyOnHand > 0), [rows])

  const purchaseTotal = useMemo(() => {
    if (!isFinance) return { value: 0, lines: 0 }
    return inStock.reduce(
      (acc, r) => {
        if (r.purchasePrice == null) return acc
        return { value: acc.value + r.qtyOnHand * r.purchasePrice, lines: acc.lines + 1 }
      },
      { value: 0, lines: 0 },
    )
  }, [inStock, isFinance])

  const colSpan = isFinance ? 10 : 9

  function toggleSort(key: InvSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    const numericDesc: InvSortKey[] = ['qty', 'weight', 'diamond', 'purchaseTotal', 'bills']
    setSortDir(numericDesc.includes(key) ? 'desc' : 'asc')
  }

  function sortTh(key: InvSortKey, label: string, align: 'left' | 'right' = 'left') {
    const active = sortKey === key
    return (
      <th
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        style={align === 'right' ? { textAlign: 'right' } : undefined}
      >
        <button
          type="button"
          className={`finance-tx-sort${active ? ' is-active' : ''}`}
          onClick={() => toggleSort(key)}
          style={align === 'right' ? { justifyContent: 'flex-end', width: '100%' } : undefined}
        >
          <span>{label}</span>
          <span className="finance-tx-sort__ind" aria-hidden>
            {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    )
  }

  return (
    <>
      <InventorySubnav />

      {isFinance ? (
        <div className="inv-kpi">
          <div className="inv-kpi__card">
            <div className="inv-kpi__label">Purchase</div>
            <div className="inv-kpi__value">{inr(purchaseTotal.value)}</div>
            <div className="inv-kpi__meta">
              {purchaseTotal.lines > 0
                ? `${purchaseTotal.lines} in-stock line${purchaseTotal.lines === 1 ? '' : 's'} with purchase price`
                : 'No purchase prices on in-stock items'}
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
              {sortTh('name', 'Item')}
              {sortTh('status', 'Status')}
              {sortTh('qty', 'Qty', 'right')}
              {sortTh('weight', 'Gold weight', 'right')}
              {sortTh('diamond', 'Diamond carats', 'right')}
              {isFinance ? sortTh('purchaseTotal', 'Purchase total', 'right') : null}
              {sortTh('bills', 'Bills')}
              {sortTh('soldTo', 'Sold to')}
              {sortTh('holder', 'Holder')}
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
                    <td style={{ textAlign: 'right' }}>{r.qtyOnHand}</td>
                    <td style={{ textAlign: 'right', color: '#6b7280' }}>{fmtGrams(r.weightGrams)}</td>
                    <td style={{ textAlign: 'right', color: '#6b7280' }}>
                      {fmtCarats(r.diamondCarats)}
                    </td>
                    {isFinance ? (
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
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
