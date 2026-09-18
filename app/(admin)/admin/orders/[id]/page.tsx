import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ORDER_STATUS_META } from '@/lib/orders'
import { getShippingProvider } from '@/lib/shipping'
import { resolvePayment } from '@/lib/refunds'
import {
  isOrderItemPriceSnapshot,
  splitGemValues,
} from '@/lib/pricing'
import { OrderJourney } from './OrderJourney'
import { OrderNotes } from './OrderNotes'
import { MarkPaidOffline } from './MarkPaidOffline'
import { inventoryDisplayName } from '@/lib/inventory'

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
      promoCode: { select: { code: true } },
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

  const inventoryAllocations = await prisma.inventoryAllocation.findMany({
    where: { orderId: order.id },
    include: {
      inventoryItem: {
        include: {
          holder: { select: { name: true } },
          product: { select: { name: true } },
          variant: { select: { sku: true, metalType: true, size: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

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

  const inr = (n: unknown) =>
    `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const inrRate = (n: unknown) =>
    `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`
  const provider = getShippingProvider(order.country)
  const payment = order.payment ?? resolvedPayment
  const paymentOwnerId = order.payment ? order.id : order.parentOrderId
  const gatewayLabel = (id: string) => (id.startsWith('mock_') ? 'Mock (dev)' : 'Razorpay')

  const fmtDt = (d: Date) =>
    d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

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
    <div className="admin-page admin-page--order-detail">
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
        <Link href={`/admin/orders/${order.id}/edit`} className="admin-btn">
          Edit order
        </Link>
        <Link href={`/admin/invoices/new?orderId=${order.id}`} className="admin-btn">
          Generate invoice
        </Link>
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
        <>
          <OrderJourney
            orderId={order.id}
            status={order.status}
            events={order.events.map((e) => ({
              id: e.id,
              status: e.status,
              note: e.note,
              createdAt: e.createdAt.toISOString(),
            }))}
            offline={!resolvedPayment}
            shippingSupportsBooking={provider.supportsBooking}
            createdAt={order.createdAt.toISOString()}
            depositAmount={Number(order.depositAmount)}
            refundedAmount={refundedTotal}
            refundedTotal={refundedTotal}
            grandTotal={Number(order.grandTotal)}
            paymentCaptured={
              resolvedPayment?.status === 'CAPTURED' ||
              resolvedPayment?.status === 'PARTIALLY_REFUNDED' ||
              resolvedPayment?.status === 'REFUNDED'
            }
            intlReviewRequired={order.intlReviewRequired}
            intlReviewApproved={order.intlReviewApproved}
          />
        </>
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

      <div className="admin-grid-2">
        <div style={card}>
          <h3 style={heading}>Items</h3>
          {order.items.map((item) => (
            <p key={item.id} style={{ fontSize: '0.875rem', marginBottom: 6 }}>
              {item.productName} × {item.quantity} — {inr(Number(item.price) * item.quantity)}
              {item.withExchange && <span style={{ color: '#b45309' }}> · with exchange</span>}
              <span style={{ color: '#9ca3af' }}> · SKU {item.variant.sku}</span>
            </p>
          ))}
          <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '10px 0' }} />
          <p style={{ fontSize: '0.875rem' }}>Goods total: {inr(order.totalAmount)}</p>
          {Number(order.depositAmount) > 0 && (
            <p style={{ fontSize: '0.875rem' }}>Security deposit (legacy): {inr(order.depositAmount)}</p>
          )}
          <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>Captured: {inr(order.grandTotal)}</p>
          {Number(order.payment?.refundedAmount ?? 0) > 0 && (
            <p style={{ fontSize: '0.875rem', color: '#b45309' }}>
              Refunded so far: {inr(order.payment!.refundedAmount)}
            </p>
          )}
          {inventoryAllocations.length > 0 && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '12px 0' }} />
              <h3 style={{ ...heading, marginBottom: 8 }}>Inventory</h3>
              {inventoryAllocations.map((a) => (
                <p key={a.id} style={{ fontSize: '0.8125rem', marginBottom: 6 }}>
                  {a.qty} unit(s) from{' '}
                  <Link href={`/admin/inventory/${a.inventoryItemId}`} style={{ color: '#032b24' }}>
                    {inventoryDisplayName(a.inventoryItem)}
                  </Link>
                  <span style={{ color: '#6b7280' }}> · held @ {a.inventoryItem.holder.name}</span>
                </p>
              ))}
            </>
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
            {order.country !== 'IN' && (
              <>
                <br />
                Country: <strong>{order.country}</strong>
              </>
            )}
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
          <h3 style={heading}>Event log</h3>
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

        <div style={card}>
          <h3 style={heading}>Payment</h3>
          {payment ? (
            <table className="order-payment-table">
              <tbody>
                <tr>
                  <th scope="row">Gateway</th>
                  <td>{gatewayLabel(payment.razorpayOrderId)}</td>
                </tr>
                <tr>
                  <th scope="row">Status</th>
                  <td>{payment.status.replace(/_/g, ' ')}</td>
                </tr>
                {paymentOwnerId && paymentOwnerId !== order.id && (
                  <tr>
                    <th scope="row">Payment on</th>
                    <td>
                      <Link href={`/admin/orders/${paymentOwnerId}`} style={{ color: '#032b24' }}>
                        {paymentOwnerId}
                      </Link>
                      {' '}
                      <span style={{ color: '#6b7280' }}>(parent order)</span>
                    </td>
                  </tr>
                )}
                <tr>
                  <th scope="row">Gateway order ID</th>
                  <td>{payment.razorpayOrderId}</td>
                </tr>
                <tr>
                  <th scope="row">Gateway payment ID</th>
                  <td>{payment.razorpayPaymentId ?? '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Last gateway refund ID</th>
                  <td>{payment.razorpayRefundId ?? '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Charged amount</th>
                  <td>{inr(payment.amount)}</td>
                </tr>
                <tr>
                  <th scope="row">This order total</th>
                  <td>
                    {inr(order.grandTotal)}
                    {paymentOwnerId && paymentOwnerId !== order.id && (
                      <span style={{ color: '#6b7280' }}> · share of parent payment</span>
                    )}
                  </td>
                </tr>
                {Number(order.discountAmount) > 0 && (
                  <tr>
                    <th scope="row">Promo discount</th>
                    <td>
                      −{inr(order.discountAmount)}
                      {order.promoCode?.code && (
                        <span style={{ color: '#6b7280' }}> · {order.promoCode.code}</span>
                      )}
                    </td>
                  </tr>
                )}
                {Number(order.depositAmount) > 0 && (
                  <tr>
                    <th scope="row">Legacy deposit</th>
                    <td>{inr(order.depositAmount)}</td>
                  </tr>
                )}
                <tr>
                  <th scope="row">Refunded (gateway)</th>
                  <td>{inr(payment.refundedAmount)}</td>
                </tr>
                <tr>
                  <th scope="row">Unrefunded balance</th>
                  <td>
                    {inr(Number(payment.amount) - Number(payment.refundedAmount))}
                    {payment.status === 'CAPTURED' && Number(payment.refundedAmount) === 0 && (
                      <span style={{ color: '#6b7280' }}> · fully captured, nothing returned yet</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Refunded (this order)</th>
                  <td>{refundedTotal > 0 ? inr(refundedTotal) : '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Recorded</th>
                  <td>{fmtDt(payment.createdAt)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="order-payment-table">
              <tbody>
                <tr>
                  <th scope="row">Type</th>
                  <td>Offline / manual</td>
                </tr>
                <tr>
                  <th scope="row">This order total</th>
                  <td>{inr(order.grandTotal)}</td>
                </tr>
                {Number(order.discountAmount) > 0 && (
                  <tr>
                    <th scope="row">Promo discount</th>
                    <td>
                      −{inr(order.discountAmount)}
                      {order.promoCode?.code && (
                        <span style={{ color: '#6b7280' }}> · {order.promoCode.code}</span>
                      )}
                    </td>
                  </tr>
                )}
                <tr>
                  <th scope="row">Refunded (this order)</th>
                  <td>{refundedTotal > 0 ? inr(refundedTotal) : '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Status</th>
                  <td>
                    {order.status === 'PAYMENT_PENDING'
                      ? 'Awaiting payment'
                      : ORDER_STATUS_META[order.status].label}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Note</th>
                  <td style={{ color: '#6b7280' }}>
                    Settled manually (UPI/bank) — no gateway payment record.
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          {!payment && order.status === 'PAYMENT_PENDING' && !order.parentOrderId && (
            <MarkPaidOffline orderId={order.id} amount={Number(order.grandTotal)} />
          )}
        </div>

        <div style={card}>
          <h3 style={heading}>Price breakdown</h3>
          {order.items.every((item) => !isOrderItemPriceSnapshot(item.priceBreakdown)) ? (
            <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
              No snapshot on this order — created before line breakdowns were stored.
            </p>
          ) : (
            order.items.map((item) => {
              const b = isOrderItemPriceSnapshot(item.priceBreakdown) ? item.priceBreakdown : null
              if (!b) {
                return (
                  <p key={item.id} style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: 12 }}>
                    {item.productName} — no snapshot
                  </p>
                )
              }
              const vaLabel = b.vaLabel || 'Wastage'
              const gems = splitGemValues(b)
              const rows: { label: string; value: string }[] = [
                ...(b.weightGrams != null
                  ? [{ label: 'Weight', value: `${Number(b.weightGrams)} g` }]
                  : []),
                ...(b.goldRatePerGram != null
                  ? [
                      {
                        label: 'Gold rate',
                        value: `${inrRate(b.goldRatePerGram)}/g${b.metalType ? ` · ${b.metalType.replace(/_/g, ' ')}` : ''}`,
                      },
                    ]
                  : []),
                { label: 'Gold', value: inr(Math.round(b.goldValue)) },
                { label: vaLabel, value: inr(Math.round(b.goldVA)) },
                { label: 'Making', value: inr(Math.round(b.making)) },
                { label: 'Diamonds', value: inr(Math.round(gems.diamonds)) },
                { label: 'Stones', value: inr(Math.round(gems.stones)) },
                ...(b.stoneLines ?? []).map((line) => ({
                  label: `  ${line.typeLabel} (${line.caratWeight} ct)`,
                  value: inr(Math.round(line.value)),
                })),
                ...(b.miscCharges
                  ? [{ label: 'Delivery', value: inr(Math.round(b.miscCharges)) }]
                  : []),
                { label: 'Taxable', value: inr(Math.round(b.taxable)) },
                { label: 'GST', value: inr(Math.round(b.gst)) },
                { label: 'Line total', value: inr(Math.round(b.total)) },
              ]
              if (item.quantity > 1) {
                rows.push({ label: `× ${item.quantity}`, value: inr(Math.round(b.total * item.quantity)) })
              }
              return (
                <div key={item.id} style={{ marginBottom: order.items.length > 1 ? 16 : 0 }}>
                  {order.items.length > 1 && (
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 8px' }}>
                      {item.productName}
                    </p>
                  )}
                  <table className="order-payment-table">
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.label}>
                          <th scope="row">{r.label}</th>
                          <td>{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
