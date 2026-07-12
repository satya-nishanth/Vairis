import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ORDER_STATUS_META } from '@/lib/orders'
import { getShippingProvider } from '@/lib/shipping'
import { OrderActions } from './OrderActions'

export const dynamic = 'force-dynamic'

/** Admin order detail — full picture + lifecycle controls. */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { variant: true } },
      payment: true,
      shipments: { orderBy: { dispatchedAt: 'desc' } },
      events: { orderBy: { createdAt: 'asc' } },
      user: { select: { email: true, name: true } },
    },
  })
  if (!order) notFound()

  const inr = (n: unknown) => `₹${Number(n).toLocaleString('en-IN')}`
  const provider = getShippingProvider()

  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    padding: '1.25rem',
    marginBottom: '1rem',
  }
  const heading: React.CSSProperties = {
    fontSize: '0.75rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: 12,
  }

  return (
    <div style={{ padding: '1rem 2rem', maxWidth: 1000 }}>
      <p style={{ marginBottom: 12, fontSize: '0.8125rem' }}>
        <Link href="/admin/orders" style={{ color: '#032b24' }}>
          ← Orders
        </Link>
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 400, color: '#111827', wordBreak: 'break-all' }}>
          {order.id}
        </h1>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#032b24' }}>
          {ORDER_STATUS_META[order.status].label}
        </span>
      </div>

      <OrderActions
        orderId={order.id}
        status={order.status}
        depositAmount={Number(order.depositAmount)}
        refundedAmount={Number(order.payment?.refundedAmount ?? 0)}
        paymentCaptured={
          order.payment?.status === 'CAPTURED' ||
          order.payment?.status === 'PARTIALLY_REFUNDED' ||
          order.payment?.status === 'REFUNDED'
        }
        offline={!order.payment}
        shippingSupportsBooking={provider.supportsBooking}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={card}>
          <h3 style={heading}>Items</h3>
          {order.items.map((item) => (
            <p key={item.id} style={{ fontSize: '0.875rem', marginBottom: 6 }}>
              {item.productName} × {item.quantity} — {inr(Number(item.price) * item.quantity)}
              <span style={{ color: '#9ca3af' }}> · SKU {item.variant.sku}</span>
            </p>
          ))}
          <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '10px 0' }} />
          <p style={{ fontSize: '0.875rem' }}>Goods total: {inr(order.totalAmount)}</p>
          <p style={{ fontSize: '0.875rem' }}>Security deposit (5%): {inr(order.depositAmount)}</p>
          <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>Captured: {inr(order.grandTotal)}</p>
          {Number(order.payment?.refundedAmount ?? 0) > 0 && (
            <p style={{ fontSize: '0.875rem', color: '#b45309' }}>
              Refunded so far: {inr(order.payment!.refundedAmount)}
            </p>
          )}
        </div>

        <div style={card}>
          <h3 style={heading}>Customer & Delivery</h3>
          <p style={{ fontSize: '0.875rem' }}>{order.user.name}</p>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>{order.user.email}</p>
          <p style={{ fontSize: '0.875rem', marginTop: 8 }}>
            {order.contactName} · {order.contactPhone}
            <br />
            {order.addressLine1}
            {order.addressLine2 ? `, ${order.addressLine2}` : ''}
            <br />
            {order.city}, {order.state} — {order.pincode}
          </p>
        </div>

        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <h3 style={heading}>Shipments</h3>
          {order.shipments.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>No dispatch yet.</p>
          ) : (
            order.shipments.map((s) => (
              <p key={s.id} style={{ fontSize: '0.875rem', marginBottom: 6 }}>
                {s.courierName ?? 'Courier —'} · AWB {s.awbCode ?? '—'} · attempts {s.attempts} · outcome{' '}
                {s.outcome ?? 'in flight'} ·{' '}
                <span style={{ color: '#9ca3af' }}>
                  {s.dispatchedAt.toLocaleDateString('en-IN')}
                </span>
                {s.trackingUrl && (
                  <>
                    {' · '}
                    <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#032b24' }}>
                      tracking ↗
                    </a>
                  </>
                )}
              </p>
            ))
          )}
        </div>

        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <h3 style={heading}>Timeline</h3>
          {order.events.map((e) => (
            <p key={e.id} style={{ fontSize: '0.8125rem', marginBottom: 6 }}>
              <span style={{ color: '#9ca3af' }}>
                {e.createdAt.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </span>{' '}
              — <strong>{ORDER_STATUS_META[e.status].label}</strong>
              {e.note ? ` · ${e.note}` : ''}
            </p>
          ))}
        </div>

        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <h3 style={heading}>Payment</h3>
          {order.payment ? (
            <p style={{ fontSize: '0.8125rem' }}>
              Gateway order: {order.payment.razorpayOrderId}
              {order.payment.razorpayPaymentId && <> · payment: {order.payment.razorpayPaymentId}</>}
              {order.payment.razorpayRefundId && <> · refund: {order.payment.razorpayRefundId}</>}
              {' · status: '}
              {order.payment.status}
            </p>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
              Offline sale — settled manually (UPI/bank), no gateway payment record.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
