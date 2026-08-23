'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { OrderStatus } from '@prisma/client'
import { ORDER_STATUS_META } from '@/lib/orders'

export type OrdersListRow = {
  id: string
  status: OrderStatus
  grandTotal: number
  contactName: string
  contactPhone: string
  createdAt: string
  email: string
  itemsLabel: string
  children?: OrdersListRow[]
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
  filterLabel: string | null
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

function statusTone(status: OrderStatus): string {
  const tone = ORDER_STATUS_META[status]?.tone ?? 'pending'
  return `orders-cards__badge is-${tone}`
}

function accentClass(status: OrderStatus): string {
  if (
    status === 'PAYMENT_CONFIRMED' ||
    status === 'PREPARING' ||
    status === 'SHIPPED' ||
    status === 'OUT_FOR_DELIVERY' ||
    status === 'SPLIT_INTO_DELIVERIES'
  ) {
    return 'is-active'
  }
  if (status === 'DELIVERED' || status === 'DEPOSIT_REFUNDED') return 'is-done'
  if (ORDER_STATUS_META[status]?.tone === 'bad') return 'is-bad'
  return 'is-muted'
}

function parentItemsLabel(order: OrdersListRow): string {
  const kids = order.children ?? []
  if (kids.length > 0) {
    return `${kids.length} deliver${kids.length === 1 ? 'y' : 'ies'}`
  }
  if (order.status === 'SPLIT_INTO_DELIVERIES') return 'Split into children'
  return order.itemsLabel || 'No items'
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

function Chevron() {
  return (
    <span className="orders-cards__chevron" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M6 3.5L10.5 8L6 12.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function ParentHeader({ order }: { order: OrdersListRow }) {
  const kids = order.children ?? []
  const isGroup = kids.length > 0

  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className={isGroup ? 'orders-cards__parent' : `orders-cards__card ${accentClass(order.status)}`}
    >
      <span className="orders-cards__who">
        <span className="orders-cards__id">{order.id.slice(-8)}</span>
        <span className="orders-cards__email">{order.email}</span>
        {isGroup && (
          <span className="orders-cards__deliveries">{parentItemsLabel(order)}</span>
        )}
      </span>
      {!isGroup && (
        <span className="orders-cards__items">{order.itemsLabel || 'No items'}</span>
      )}
      {isGroup && <span className="orders-cards__items" aria-hidden />}
      <span className="orders-cards__amount">{inr(order.grandTotal)}</span>
      <span className={statusTone(order.status)}>
        {ORDER_STATUS_META[order.status]?.label ?? order.status}
      </span>
      <span className="orders-cards__date">
        {new Date(order.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        })}
      </span>
      <Chevron />
    </Link>
  )
}

function ChildRow({ child }: { child: OrdersListRow }) {
  return (
    <Link href={`/admin/orders/${child.id}`} className="orders-cards__child">
      <span className="orders-cards__who">
        <span className="orders-cards__id">{child.id.slice(-8)}</span>
      </span>
      <span className="orders-cards__items">{child.itemsLabel || 'No items'}</span>
      <span className="orders-cards__amount">{inr(child.grandTotal)}</span>
      <span className={statusTone(child.status)}>
        {ORDER_STATUS_META[child.status]?.label ?? child.status}
      </span>
      <span className="orders-cards__date orders-cards__date--hide-sm" aria-hidden />
      <Chevron />
    </Link>
  )
}

/** Option A — card rows; split parents nest children in the same card. */
export function OrdersWorkbench({
  orders,
  chips,
  activeChip,
  moreStatuses,
  filterLabel,
}: OrdersWorkbenchProps) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return orders
    return orders.filter((o) => matchesQuery(o, t))
  }, [orders, q])

  return (
    <div className="orders-cards">
      <div className="orders-cards__toolbar">
        <h1 className="orders-cards__title">Orders</h1>
        <Link href="/admin/orders/new" className="admin-btn">
          + Manual order
        </Link>
      </div>

      <label className="orders-cards__search">
        <span className="sr-only">Search orders</span>
        <input
          type="search"
          placeholder="Search order, email, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
      </label>

      <div className="orders-cards__filters">
        <div className="orders-cards__chips" role="tablist" aria-label="Status filter">
          {chips.map((c) => {
            const active = c.key === activeChip
            return (
              <Link
                key={c.key}
                href={c.href}
                role="tab"
                aria-selected={active}
                className={active ? 'orders-cards__chip is-active' : 'orders-cards__chip'}
              >
                {c.label}
              </Link>
            )
          })}
        </div>
        <label className="orders-cards__more">
          <span className="sr-only">More status filters</span>
          <select
            className="orders-cards__more-select"
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

      {orders.length === 0 ? (
        <p className="orders-cards__empty">
          No orders{filterLabel ? ` in ${filterLabel}` : ' yet'}.
        </p>
      ) : filtered.length === 0 ? (
        <p className="orders-cards__empty">No orders match “{q.trim()}”.</p>
      ) : (
        <>
          <ul className="orders-cards__list">
            {filtered.map((order) => {
              const kids = order.children ?? []
              if (kids.length === 0) {
                return (
                  <li key={order.id}>
                    <ParentHeader order={order} />
                  </li>
                )
              }
              return (
                <li key={order.id}>
                  <div className={`orders-cards__group ${accentClass(order.status)}`}>
                    <ParentHeader order={order} />
                    <div className="orders-cards__nest">
                      <ul className="orders-cards__children">
                        {kids.map((child) => (
                          <li key={child.id} className="orders-cards__child-wrap">
                            <ChildRow child={child} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="orders-cards__count">
            Showing {filtered.length}
            {q.trim() ? ` of ${orders.length}` : ''} order
            {filtered.length === 1 ? '' : 's'}
          </p>
        </>
      )}
    </div>
  )
}
