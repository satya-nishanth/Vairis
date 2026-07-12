import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ORDER_STATUS_META } from '@/lib/orders'
import { getShippingProvider } from '@/lib/shipping'
import { resolvePayment } from '@/lib/refunds'
import { OrderActions } from './OrderActions'
import { OrderNotes } from './OrderNotes'

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
      refunds: { orderBy: { createdAt: 'desc' } },
      notes: { orderBy: { createdAt: 'desc' } },
      user: { select: { email: true, name: true } },
      children: {
        include: { refunds: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!order) notFound()

  const refundedTotal = Number(
    (await prisma.orderRefund.aggregate({ where: { orderId: order.id }, _sum: { amount: true } }))._sum.amount ?? 0,
  )

  // Children have no Payment row of their own — the gateway payment lives
  // permanently on the parent (payment anchoring, lib/split.ts). Resolve it
  // the same way lib/refunds.ts does so the refund UI reflects reality for
  // child orders too, instead of reading the always-null order.payment.
  const resolved = await resolvePayment(order.id)
  const resolvedPayment = resolved?.payment ?? null
  const isSplitParent = order.status === 'SPLIT_INTO_DELIVERIES' && order.children.length > 0

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

      {order.parentOrderId && (
        <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.8125rem', color: '#3730a3' }}>
          Payment via parent{' '}
          <Link href={`/admin/orders/${order.parentOrderId}`} style={{ color: '#3730a3', fontWeight: 600 }}>
            {order.parentOrderId} →
          </Link>
          {resolvedPayment && <> · {inr(order.grandTotal)} of this delivery drawn from that payment</>}
        </div>
      )}

      {/* Split parents manage actions per-delivery (each child has its own
          status + refund); the parent itself only shows the rollup below. */}
      {!isSplitParent && (
        <OrderActions
          orderId={order.id}
          status={order.status}
          depositAmount={Number(order.depositAmount)}
          // Own-order ledger total (refundedTotal, scoped to order.id below),
          // NOT resolvedPayment.refundedAmount — that field is the shared
          // parent Payment's cumulative total across ALL children, so a
          // sibling's refund would incorrectly hide this order's own
          // deposit-refund button (lib/split.ts payment anchoring).
          refundedAmount={refundedTotal}
          refundedTotal={refundedTotal}
          grandTotal={Number(order.grandTotal)}
          paymentCaptured={
            resolvedPayment?.status === 'CAPTURED' ||
            resolvedPayment?.status === 'PARTIALLY_REFUNDED' ||
            resolvedPayment?.status === 'REFUNDED'
          }
          offline={!resolvedPayment}
          shippingSupportsBooking={provider.supportsBooking}
        />
      )}

      {isSplitParent && (
        <div style={{ ...card, marginBottom: '1rem' }}>
          <h3 style={heading}>{order.children.length} Deliveries</h3>
          <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: '4px 8px 4px 0' }}>Order</th>
                <th style={{ padding: '4px 8px' }}>Status</th>
                <th style={{ padding: '4px 8px' }}>Goods</th>
                <th style={{ padding: '4px 8px' }}>Deposit</th>
                <th style={{ padding: '4px 8px' }}>Refunded</th>
              </tr>
            </thead>
            <tbody>
              {order.children.map((child) => {
                const childRefunded = child.refunds.reduce((s, r) => s + Number(r.amount), 0)
                return (
                  <tr key={child.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 8px 6px 0' }}>
                      <Link href={`/admin/orders/${child.id}`} style={{ color: '#032b24' }}>
                        {child.id}
                      </Link>
                    </td>
                    <td style={{ padding: '6px 8px' }}>{ORDER_STATUS_META[child.status].label}</td>
                    <td style={{ padding: '6px 8px' }}>{inr(child.totalAmount)}</td>
                    <td style={{ padding: '6px 8px' }}>{inr(child.depositAmount)}</td>
                    <td style={{ padding: '6px 8px' }}>{childRefunded > 0 ? inr(childRefunded) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {(() => {
            const captured = Number(order.grandTotal)
            const refundedAcrossChildren = order.children.reduce(
              (s, c) => s + c.refunds.reduce((s2, r) => s2 + Number(r.amount), 0),
              0,
            )
            const remaining = captured - refundedAcrossChildren
            return (
              <p style={{ marginTop: 12, fontSize: '0.875rem', fontWeight: 600 }}>
                captured {inr(captured)} · refunded {inr(refundedAcrossChildren)} · remaining {inr(remaining)}
              </p>
            )
          })()}
        </div>
      )}

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
          <h3 style={heading}>Refunds</h3>
          {order.refunds.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>No refunds issued.</p>
          ) : (
            order.refunds.map((r) => (
              <p key={r.id} style={{ fontSize: '0.875rem', marginBottom: 6 }}>
                {inr(r.amount)} · {r.kind.toLowerCase()} · {r.method.toLowerCase()} · {r.status.toLowerCase()}
                {r.reason ? ` · ${r.reason}` : ''}{' '}
                <span style={{ color: '#9ca3af' }}>
                  {r.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
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

        <OrderNotes orderId={order.id} notes={order.notes} />

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
          ) : order.parentOrderId && resolvedPayment ? (
            <p style={{ fontSize: '0.8125rem' }}>
              Via parent{' '}
              <Link href={`/admin/orders/${order.parentOrderId}`} style={{ color: '#032b24' }}>
                {order.parentOrderId}
              </Link>
              {' — gateway order: '}
              {resolvedPayment.razorpayOrderId}
              {resolvedPayment.razorpayPaymentId && <> · payment: {resolvedPayment.razorpayPaymentId}</>}
              {' · status: '}
              {resolvedPayment.status}
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
