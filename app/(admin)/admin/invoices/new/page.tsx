import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { blankPayload } from '@/lib/invoice-document'
import { invoiceFromOrderId, loadInvoiceCatalogue } from '@/lib/invoice-build'
import { InvoiceComposer } from '@/components/admin/InvoiceComposer'
import { ORDER_STATUS_META } from '@/lib/orders'
import type { OrderStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

function statusLabel(status: string) {
  const meta = ORDER_STATUS_META[status as OrderStatus]
  return meta?.label ?? status.replace(/_/g, ' ')
}

function statusTone(status: string): 'pending' | 'active' | 'done' | 'bad' | 'muted' {
  return ORDER_STATUS_META[status as OrderStatus]?.tone ?? 'muted'
}

function formatOrderDay(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; addVariant?: string }>
}) {
  const { orderId, addVariant } = await searchParams

  const [built, catalogue, recentOrders] = await Promise.all([
    orderId ? invoiceFromOrderId(orderId) : Promise.resolve(null),
    loadInvoiceCatalogue(),
    prisma.order.findMany({
      where: { parentOrderId: null },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        contactName: true,
        contactPhone: true,
        city: true,
        state: true,
        status: true,
        grandTotal: true,
        createdAt: true,
      },
    }),
  ])

  const payload = built?.payload ?? blankPayload()
  const selected = orderId ? recentOrders.find((o) => o.id === orderId) : null
  const orderMissing = Boolean(orderId && !built)

  return (
    <div className="admin-page" style={{ maxWidth: 1100 }}>
      <p style={{ marginBottom: 12, fontSize: '0.8125rem' }}>
        <Link href="/admin/invoices" style={{ color: '#032b24' }}>
          ← Invoices
        </Link>
      </p>
      <h1 className="admin-page__title">New invoice</h1>

      {!orderId && (
        <section className="inv-order-pick" aria-label="Start from a recent order">
          <div className="inv-order-pick__head">
            <h2 className="inv-order-pick__title">Start from a recent order</h2>
            <p className="inv-order-pick__sub">
              Click an order to pre-fill customer, address, phone, payment, dates, and line items.
              Or skip and fill a blank invoice below.
            </p>
          </div>

          {recentOrders.length === 0 ? (
            <p className="inv-order-pick__empty">No orders yet — use the blank form.</p>
          ) : (
            <ul className="inv-order-pick__list">
              {recentOrders.map((o) => {
                const tone = statusTone(o.status)
                const name = o.contactName?.trim() || 'Guest'
                const place = [o.city, o.state].filter(Boolean).join(', ')
                return (
                  <li key={o.id}>
                    <Link
                      href={`/admin/invoices/new?orderId=${o.id}`}
                      className="inv-order-pick__row"
                    >
                      <div className="inv-order-pick__main">
                        <span className="inv-order-pick__name">{name}</span>
                        <span className={`inv-order-pick__status inv-order-pick__status--${tone}`}>
                          {statusLabel(o.status)}
                        </span>
                      </div>
                      <div className="inv-order-pick__meta">
                        {o.contactPhone ? (
                          <span>+91 {o.contactPhone}</span>
                        ) : (
                          <span className="inv-order-pick__muted">No phone</span>
                        )}
                        {place && <span>{place}</span>}
                        <span>{formatOrderDay(o.createdAt)}</span>
                      </div>
                      <div className="inv-order-pick__aside">
                        <span className="inv-order-pick__amount">
                          ₹{Number(o.grandTotal).toLocaleString('en-IN')}
                        </span>
                        <span className="inv-order-pick__cta">Use order →</span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {orderId && (
        <div className={`inv-order-banner${orderMissing ? ' inv-order-banner--warn' : ''}`}>
          {orderMissing ? (
            <p>
              Order not found — showing a blank invoice.{' '}
              <Link href="/admin/invoices/new">Pick another order</Link>
            </p>
          ) : (
            <p>
              Prefilling from{' '}
              <strong>{selected?.contactName?.trim() || 'order'}</strong>
              {selected ? (
                <>
                  {' '}
                  · {statusLabel(selected.status)} · ₹
                  {Number(selected.grandTotal).toLocaleString('en-IN')} ·{' '}
                  {formatOrderDay(selected.createdAt)}
                </>
              ) : null}
              .{' '}
              <Link href="/admin/invoices/new">Clear &amp; start blank</Link>
            </p>
          )}
        </div>
      )}

      <InvoiceComposer
        key={orderId ?? 'blank'}
        initial={payload}
        orderId={orderId ?? null}
        catalogue={catalogue}
        returnPath={orderId ? `/admin/invoices/new?orderId=${orderId}` : '/admin/invoices/new'}
        addVariantId={addVariant ?? null}
      />
    </div>
  )
}
