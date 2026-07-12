import Link from 'next/link'
import type { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ORDER_STATUS_META } from '@/lib/orders'

export const dynamic = 'force-dynamic'

const FILTERS: (OrderStatus | 'ALL')[] = [
  'ALL',
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DEPOSIT_REFUNDED',
  'DELIVERY_FAILED',
  'RETURNING_TO_ORIGIN',
  'RTO_RECEIVED',
  'RETURN_REQUESTED',
  'RETURN_IN_TRANSIT',
  'RETURN_RECEIVED',
  'PAYMENT_EXPIRED',
  'SPLIT_INTO_DELIVERIES',
  'FAILED_OTHER',
  'CANCELLED',
  'REFUNDED',
]

/** Admin order list — filter chips per status, newest first. */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const filter = FILTERS.includes(status as OrderStatus) ? (status as OrderStatus) : null

  const orders = await prisma.order.findMany({
    where: filter ? { status: filter } : undefined,
    include: {
      items: true,
      payment: { select: { refundedAmount: true } },
      user: { select: { email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const inr = (n: unknown) => `₹${Number(n).toLocaleString('en-IN')}`

  return (
    <div style={{ padding: '1rem 2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827' }}>Orders</h1>
        <Link
          href="/admin/orders/new"
          style={{
            padding: '0.625rem 1.5rem',
            background: '#032b24',
            color: '#fff',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          + Manual Order
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {FILTERS.map((f) => {
          const active = (f === 'ALL' && !filter) || f === filter
          return (
            <Link
              key={f}
              href={f === 'ALL' ? '/admin/orders' : `/admin/orders?status=${f}`}
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
              {f === 'ALL' ? 'All' : ORDER_STATUS_META[f as OrderStatus].label}
            </Link>
          )
        })}
      </div>

      {orders.length === 0 ? (
        <p style={{ color: '#6b7280', padding: '2rem 0' }}>No orders{filter ? ` in ${filter}` : ' yet'}.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
              <th style={{ padding: '10px 12px' }}>Order</th>
              <th style={{ padding: '10px 12px' }}>Customer</th>
              <th style={{ padding: '10px 12px' }}>Items</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Paid (105%)</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Deposit</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
              <th style={{ padding: '10px 12px' }}>Placed</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px' }}>
                  <Link href={`/admin/orders/${order.id}`} style={{ color: '#032b24', fontWeight: 600 }}>
                    {order.id.slice(-8)}
                  </Link>
                </td>
                <td style={{ padding: '10px 12px' }}>{order.user.email}</td>
                <td style={{ padding: '10px 12px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {order.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ')}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{inr(order.grandTotal)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {Number(order.payment?.refundedAmount ?? 0) > 0 ? '↩ ' : ''}
                  {inr(order.depositAmount)}
                </td>
                <td style={{ padding: '10px 12px' }}>{ORDER_STATUS_META[order.status].label}</td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  {order.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
