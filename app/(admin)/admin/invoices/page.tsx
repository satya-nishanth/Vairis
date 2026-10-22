import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { AdminGuide } from '@/components/admin/AdminGuide'
import { InvoiceDeleteButton } from '@/components/admin/InvoiceDeleteButton'
import {
  invoiceItemsLabel,
  invoiceStatusFromPayload,
  type InvoicePayload,
} from '@/lib/invoice-document'

export const dynamic = 'force-dynamic'

export default async function AdminInvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { order: { select: { id: true, contactName: true } } },
  })

  const inr = (n: unknown) => `₹${Number(n).toLocaleString('en-IN')}`

  return (
    <div className="admin-page admin-page--invoices">
      <div className="admin-page__header admin-invoices__header">
        <h1 className="admin-page__title" style={{ marginBottom: 0 }}>
          Invoices
        </h1>
        <Link href="/admin/invoices/new" className="admin-btn">
          New invoice
        </Link>
      </div>
      <AdminGuide
        pageKey="invoices"
        title="Tax invoices"
        blurb="Generate a GST tax invoice from an order (with HUID/cert overrides) or from a blank form. Totals use the same wastage + 3% GST formula as the storefront."
        tips={[
          'Saving snapshots the gold rate and breakup so reprints stay frozen if rates move.',
          'Place of supply Maharashtra → CGST + SGST; other states → IGST.',
          'Use Print / PDF and the browser print dialog to save as PDF.',
        ]}
      />

      <div className="admin-table-wrap admin-invoices__table-wrap">
        <table className="admin-invoices__table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Item</th>
              <th>Order</th>
              <th className="is-num">Total</th>
              <th>Status</th>
              <th className="is-actions" />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="admin-invoices__empty">
                  No invoices yet. Create one from an order or a blank form.
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const payload = inv.payload as InvoicePayload
              // Prefer live payment.status — stored column may be wrong on pre-STG-61 rows.
              const status = invoiceStatusFromPayload(payload)
              const itemLabel = invoiceItemsLabel(payload)
              return (
                <tr key={inv.id}>
                  <td className="admin-invoices__number">{inv.number}</td>
                  <td>
                    {inv.createdAt.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td>{payload.billedTo?.name || inv.order?.contactName || '—'}</td>
                  <td className="admin-invoices__item" title={itemLabel}>
                    {itemLabel}
                  </td>
                  <td>
                    {inv.orderId ? (
                      <Link href={`/admin/orders/${inv.orderId}`} className="admin-invoices__order-link">
                        {inv.orderId.slice(0, 8)}…
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="is-num">{inr(inv.grandTotal)}</td>
                  <td>
                    <span
                      className={
                        status === 'PAID'
                          ? 'admin-invoices__status is-paid'
                          : 'admin-invoices__status is-unpaid'
                      }
                    >
                      {status}
                    </span>
                  </td>
                  <td className="admin-invoices__actions">
                    <Link href={`/admin/invoices/${inv.id}`}>Edit</Link>
                    <Link href={`/admin/invoices/${inv.id}/print`}>Print</Link>
                    <InvoiceDeleteButton id={inv.id} number={inv.number} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
