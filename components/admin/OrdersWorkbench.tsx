'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { OrderStatus, PaymentStatus } from '@prisma/client'
import {
  ORDER_STATUS_META,
  buildAdminJourneyNodes,
  type AdminJourneyNode,
} from '@/lib/orders'

export type OrdersListItem = {
  productName: string
  quantity: number
  imageUrl: string | null
}

export type OrdersListEvent = {
  id: string
  status: OrderStatus
  note: string | null
  createdAt: string
}

export type OrdersListPayment = {
  status: PaymentStatus
  amount: number
  razorpayPaymentId: string | null
  createdAt: string
}

export type OrdersListRow = {
  id: string
  status: OrderStatus
  grandTotal: number
  contactName: string
  contactPhone: string
  createdAt: string
  email: string
  itemsLabel: string
  itemCount: number
  items: OrdersListItem[]
  payment: OrdersListPayment | null
  events: OrdersListEvent[]
  children?: OrdersListRow[]
}

export type OrdersKpi = {
  key: string
  label: string
  count: number
  href: string
}

type Chip = {
  key: string
  label: string
  href: string
}

type OrdersWorkbenchProps = {
  orders: OrdersListRow[]
  chips: Chip[]
  activeChip: string
  moreStatuses: Chip[]
  channelChips: Chip[]
  activeChannel: string
  gstChips: Chip[]
  activeGst: string
  filterLabel: string | null
  kpis: OrdersKpi[]
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

function statusTone(status: OrderStatus): string {
  const tone = ORDER_STATUS_META[status]?.tone ?? 'pending'
  return `orders-wb__badge is-${tone}`
}

function isPaid(order: OrdersListRow): boolean {
  if (order.payment?.status === 'CAPTURED') return true
  return (
    order.status === 'PAYMENT_CONFIRMED' ||
    order.status === 'PREPARING' ||
    order.status === 'SHIPPED' ||
    order.status === 'OUT_FOR_DELIVERY' ||
    order.status === 'DELIVERED' ||
    order.status === 'DEPOSIT_REFUNDED' ||
    order.status === 'SPLIT_INTO_DELIVERIES'
  )
}

function itemsDisplay(order: OrdersListRow): string {
  const kids = order.children ?? []
  if (kids.length > 0) {
    const names = kids
      .flatMap((c) => c.items.map((i) => i.productName))
      .filter(Boolean)
    const unique = [...new Set(names)]
    if (unique.length === 0) {
      return `${kids.length} deliver${kids.length === 1 ? 'y' : 'ies'}`
    }
    if (unique.length === 1) return unique[0]
    if (unique.length === 2) return `${unique[0]}, ${unique[1]}`
    return `${unique[0]} +${unique.length - 1} more`
  }
  if (order.items.length === 0) return order.itemsLabel || 'No items'
  if (order.items.length === 1) {
    const i = order.items[0]
    return i.quantity > 1 ? `${i.productName} ×${i.quantity}` : i.productName
  }
  const first = order.items[0].productName
  return `${first} +${order.items.length - 1} more`
}

function previewImages(order: OrdersListRow): OrdersListItem[] {
  const kids = order.children ?? []
  const source = kids.length > 0 ? kids.flatMap((c) => c.items) : order.items
  const seen = new Set<string>()
  const out: OrdersListItem[] = []
  for (const item of source) {
    const key = item.imageUrl ?? item.productName
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
    if (out.length >= 4) break
  }
  return out
}

function matchesQuery(order: OrdersListRow, t: string): boolean {
  if (
    order.id.toLowerCase().includes(t) ||
    order.id.slice(-8).toLowerCase().includes(t) ||
    order.email.toLowerCase().includes(t) ||
    order.contactName.toLowerCase().includes(t) ||
    order.contactPhone.includes(t) ||
    order.itemsLabel.toLowerCase().includes(t)
  ) {
    return true
  }
  return (order.children ?? []).some((c) => matchesQuery(c, t))
}

function findOrder(orders: OrdersListRow[], id: string | null): OrdersListRow | null {
  if (!id) return null
  for (const o of orders) {
    if (o.id === id) return o
    for (const c of o.children ?? []) {
      if (c.id === id) return c
    }
  }
  return null
}

// Rendered in the browser, so pin the zone — otherwise an admin outside India
// sees their own local time instead of the store's (STG-55).
function formatWhen(iso: string): string {
  const when = new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${when} IST`
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function JourneyStrip({ nodes }: { nodes: AdminJourneyNode[] }) {
  return (
    <ol className="orders-wb__journey">
      {nodes.map((node, i) => (
        <li
          key={node.id}
          className={`orders-wb__journey-step is-${node.state}${node.isActive ? ' is-active' : ''}`}
        >
          {i > 0 && <span className="orders-wb__journey-line" aria-hidden />}
          <span className="orders-wb__journey-dot" aria-hidden>
            {node.state === 'done' ? (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 7.2L5.8 10L11 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </span>
          <span className="orders-wb__journey-label">{node.label}</span>
          <span className="orders-wb__journey-when">
            {node.enteredAt
              ? formatWhen(
                  node.enteredAt instanceof Date
                    ? node.enteredAt.toISOString()
                    : String(node.enteredAt),
                )
              : node.state === 'todo'
                ? 'Pending'
                : '—'}
          </span>
        </li>
      ))}
    </ol>
  )
}

function JourneyPreview({ order }: { order: OrdersListRow }) {
  const nodes = useMemo(
    () => buildAdminJourneyNodes(order.events, order.status, order.createdAt),
    [order],
  )
  const images = previewImages(order)
  const paid = isPaid(order)

  return (
    <aside className="orders-wb__preview" aria-label="Journey preview">
      <div className="orders-wb__preview-head">
        <h2 className="orders-wb__preview-title">Journey preview</h2>
        <span className="orders-wb__preview-id">{order.id.slice(-8)}</span>
      </div>

      {images.length > 0 && (
        <div className="orders-wb__preview-gallery">
          {images.map((item, i) => (
            <div key={`${item.productName}-${i}`} className="orders-wb__preview-shot">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.productName}
                  fill
                  sizes="120px"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <span className="orders-wb__preview-shot-empty" />
              )}
            </div>
          ))}
        </div>
      )}

      <dl className="orders-wb__preview-customer">
        <div>
          <dt>Name</dt>
          <dd>{order.contactName || '—'}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{order.email}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{order.contactPhone || '—'}</dd>
        </div>
      </dl>

      <div className="orders-wb__preview-section">
        <h3 className="orders-wb__preview-section-title">Order journey</h3>
        <JourneyStrip nodes={nodes} />
      </div>

      <div className="orders-wb__preview-section">
        <h3 className="orders-wb__preview-section-title">Payment</h3>
        <dl className="orders-wb__preview-payment">
          <div>
            <dt>Status</dt>
            <dd>
              <span className={paid ? 'orders-wb__paid is-yes' : 'orders-wb__paid'}>
                <span className="orders-wb__paid-dot" aria-hidden />
                {paid ? 'Paid' : 'Unpaid'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>
              {order.payment
                ? order.payment.razorpayPaymentId?.startsWith('mock_')
                  ? 'Mock gateway'
                  : 'Razorpay'
                : 'Offline / pending'}
            </dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>{inr(order.payment?.amount ?? order.grandTotal)}</dd>
          </div>
          {order.payment?.razorpayPaymentId && (
            <div>
              <dt>Txn ID</dt>
              <dd className="orders-wb__mono">{order.payment.razorpayPaymentId}</dd>
            </div>
          )}
          {order.payment && (
            <div>
              <dt>Paid on</dt>
              <dd>{formatWhen(order.payment.createdAt)}</dd>
            </div>
          )}
        </dl>
      </div>

      {order.itemsLabel && (
        <div className="orders-wb__preview-section">
          <h3 className="orders-wb__preview-section-title">Items</h3>
          <p className="orders-wb__preview-items">{order.itemsLabel}</p>
        </div>
      )}

      <Link href={`/admin/orders/${order.id}`} className="orders-wb__preview-cta">
        View order details
        <span aria-hidden>→</span>
      </Link>
    </aside>
  )
}

function OrderRow({
  order,
  selected,
  onSelect,
  nested,
}: {
  order: OrdersListRow
  selected: boolean
  onSelect: () => void
  nested?: boolean
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`orders-wb__row${selected ? ' is-selected' : ''}${nested ? ' is-nested' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <span className="orders-wb__col-order">
        <span className="orders-wb__id">{order.id.slice(-8)}</span>
        {nested && <span className="orders-wb__nested-tag">Delivery</span>}
      </span>
      <span className="orders-wb__col-customer">
        <span className="orders-wb__name">{order.contactName || '—'}</span>
        <span className="orders-wb__meta">{order.email}</span>
        {order.contactPhone ? (
          <span className="orders-wb__meta">{order.contactPhone}</span>
        ) : null}
      </span>
      <span className="orders-wb__col-items" title={order.itemsLabel || undefined}>
        {itemsDisplay(order)}
      </span>
      <span className="orders-wb__col-paid">
        <span className={isPaid(order) ? 'orders-wb__paid is-yes' : 'orders-wb__paid'}>
          <span className="orders-wb__paid-dot" aria-hidden />
          {isPaid(order) ? 'Paid' : 'Unpaid'}
        </span>
        <span className="orders-wb__amount">{inr(order.grandTotal)}</span>
      </span>
      <span className="orders-wb__col-status">
        <span className={statusTone(order.status)}>
          {ORDER_STATUS_META[order.status]?.label ?? order.status}
        </span>
      </span>
      <span className="orders-wb__col-date">{formatShortDate(order.createdAt)}</span>
      <span className="orders-wb__col-action">
        <Link
          href={`/admin/orders/${order.id}`}
          className="orders-wb__open"
          onClick={(e) => e.stopPropagation()}
        >
          Open Order
        </Link>
      </span>
    </div>
  )
}

/** Split workbench: order table + journey preview (product images live in the preview). */
export function OrdersWorkbench({
  orders,
  chips,
  activeChip,
  moreStatuses,
  channelChips,
  activeChannel,
  gstChips,
  activeGst,
  filterLabel,
  kpis,
}: OrdersWorkbenchProps) {
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(orders[0]?.id ?? null)
  const [filtersOpen, setFiltersOpen] = useState(true)

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return orders
    return orders.filter((o) => matchesQuery(o, t))
  }, [orders, q])

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null)
      return
    }
    if (!findOrder(filtered, selectedId)) {
      setSelectedId(filtered[0].id)
    }
  }, [filtered, selectedId])

  const selected = findOrder(filtered, selectedId) ?? findOrder(orders, selectedId)

  const activeFilterBits = [
    activeChip !== 'ALL' ? chips.find((c) => c.key === activeChip)?.label ?? activeChip : null,
    activeChannel !== 'all'
      ? channelChips.find((c) => c.key === activeChannel)?.label ?? activeChannel
      : null,
    activeGst !== 'all' ? gstChips.find((c) => c.key === activeGst)?.label ?? activeGst : null,
  ].filter(Boolean) as string[]

  return (
    <div className="orders-wb">
      <div className="orders-wb__toolbar">
        <h1 className="orders-wb__title">Orders</h1>
        <div className="orders-wb__toolbar-right">
          <label className="orders-wb__search">
            <span className="sr-only">Search orders</span>
            <input
              type="search"
              placeholder="Search order, email, phone…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          </label>
          <Link href="/admin/orders/new" className="admin-btn">
            + Manual order
          </Link>
        </div>
      </div>

      <section className="orders-wb__panel">
        <button
          type="button"
          className="orders-wb__panel-toggle"
          aria-expanded={filtersOpen}
          aria-controls="orders-wb-filters-panel"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <span className="orders-wb__panel-toggle-text">
            <strong>Filters &amp; queues</strong>
            {activeFilterBits.length > 0 && (
              <span className="orders-wb__panel-summary">{activeFilterBits.join(' · ')}</span>
            )}
          </span>
          <span className="orders-wb__panel-chevron" aria-hidden>
            {filtersOpen ? '▾' : '▸'}
          </span>
        </button>

        {filtersOpen && (
          <div id="orders-wb-filters-panel" className="orders-wb__panel-body">
            <div className="orders-wb__panel-filters">
              <div className="orders-wb__filter-row">
                <span className="orders-wb__filter-label">Status</span>
                <div className="orders-wb__chips" role="tablist" aria-label="Status filter">
                  {chips.map((c) => {
                    const active = c.key === activeChip
                    return (
                      <Link
                        key={c.key}
                        href={c.href}
                        role="tab"
                        aria-selected={active}
                        className={active ? 'orders-wb__chip is-active' : 'orders-wb__chip'}
                      >
                        {c.label}
                      </Link>
                    )
                  })}
                </div>
                <label className="orders-wb__more">
                  <span className="sr-only">More status filters</span>
                  <select
                    className="orders-wb__more-select"
                    value={moreStatuses.some((m) => m.key === activeChip) ? activeChip : ''}
                    onChange={(e) => {
                      const href = moreStatuses.find((m) => m.key === e.target.value)?.href
                      if (href) window.location.href = href
                    }}
                  >
                    <option value="">More filters</option>
                    {moreStatuses.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="orders-wb__filter-row">
                <span className="orders-wb__filter-label">Channel</span>
                <div className="orders-wb__chips" role="tablist" aria-label="Channel filter">
                  {channelChips.map((c) => {
                    const active = c.key === activeChannel
                    return (
                      <Link
                        key={c.key}
                        href={c.href}
                        role="tab"
                        aria-selected={active}
                        className={active ? 'orders-wb__chip is-active' : 'orders-wb__chip'}
                      >
                        {c.label}
                      </Link>
                    )
                  })}
                </div>
              </div>

              <div className="orders-wb__filter-row">
                <span className="orders-wb__filter-label">Tax</span>
                <div className="orders-wb__chips" role="tablist" aria-label="GST filter">
                  {gstChips.map((c) => {
                    const active = c.key === activeGst
                    return (
                      <Link
                        key={c.key}
                        href={c.href}
                        role="tab"
                        aria-selected={active}
                        className={active ? 'orders-wb__chip is-active' : 'orders-wb__chip'}
                      >
                        {c.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="orders-wb__panel-kpis" aria-label="Order queues">
              {kpis.map((k) => (
                <Link
                  key={k.key}
                  href={k.href}
                  className={`orders-wb__kpi${activeChip === k.key ? ' is-active' : ''}`}
                >
                  <span className="orders-wb__kpi-label">{k.label}</span>
                  <span className="orders-wb__kpi-value">{k.count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="orders-wb__split">
        <div className="orders-wb__list-pane">
          {orders.length === 0 ? (
            <p className="orders-wb__empty">
              No orders{filterLabel ? ` in ${filterLabel}` : ' yet'}.
            </p>
          ) : filtered.length === 0 ? (
            <p className="orders-wb__empty">No orders match “{q.trim()}”.</p>
          ) : (
            <>
              <div className="orders-wb__table-head" aria-hidden>
                <span>Order</span>
                <span>Customer</span>
                <span>Items</span>
                <span>Paid</span>
                <span>Status</span>
                <span>Date</span>
                <span />
              </div>
              <ul className="orders-wb__list">
                {filtered.map((order) => {
                  const kids = order.children ?? []
                  if (kids.length === 0) {
                    return (
                      <li key={order.id} className="orders-wb__group">
                        <OrderRow
                          order={order}
                          selected={selectedId === order.id}
                          onSelect={() => setSelectedId(order.id)}
                        />
                      </li>
                    )
                  }
                  return (
                    <li key={order.id} className="orders-wb__group is-split">
                      <OrderRow
                        order={order}
                        selected={selectedId === order.id}
                        onSelect={() => setSelectedId(order.id)}
                      />
                      <div className="orders-wb__nest">
                        <ul className="orders-wb__children">
                          {kids.map((child) => (
                            <li key={child.id} className="orders-wb__child-wrap">
                              <OrderRow
                                order={child}
                                selected={selectedId === child.id}
                                onSelect={() => setSelectedId(child.id)}
                                nested
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="orders-wb__count">
                Showing {filtered.length}
                {q.trim() ? ` of ${orders.length}` : ''} order
                {filtered.length === 1 ? '' : 's'}
              </p>
            </>
          )}
        </div>

        {selected ? (
          <JourneyPreview order={selected} />
        ) : (
          <aside className="orders-wb__preview orders-wb__preview--empty">
            <p>Select an order to preview its journey.</p>
          </aside>
        )}
      </div>
    </div>
  )
}
