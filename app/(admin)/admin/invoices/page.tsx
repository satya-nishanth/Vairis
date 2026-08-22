import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { AdminGuide } from '@/components/admin/AdminGuide'
import { InvoiceDeleteButton } from '@/components/admin/InvoiceDeleteButton'

export const dynamic = 'force-dynamic'

export default async function AdminInvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { order: { select: { id: true, contactName: true } } },
  })

  const inr = (n: unknown) => `₹${Number(n).toLocaleString('en-IN')}`

  return (
    <div className="admin-page" style={{ maxWidth: 1100 }}>
      <div className="admin-page__header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
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

      <div className="admin-table-wrap">
        <table className="admin-products" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 10 }}>Number</th>
              <th style={{ textAlign: 'left', padding: 10 }}>Date</th>
              <th style={{ textAlign: 'left', padding: 10 }}>Customer</th>
              <th style={{ textAlign: 'left', padding: 10 }}>Order</th>
              <th style={{ textAlign: 'right', padding: 10 }}>Total</th>
              <th style={{ textAlign: 'left', padding: 10 }}>Status</th>
              <th style={{ padding: 10 }} />
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: '#6b7280' }}>
                  No invoices yet. Create one from an order or a blank form.
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const payload = inv.payload as { billedTo?: { name?: string } }
              return (
                <tr key={inv.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 10 }}>{inv.number}</td>
                  <td style={{ padding: 10 }}>
                    {inv.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: 10 }}>{payload.billedTo?.name || inv.order?.contactName || '—'}</td>
                  <td style={{ padding: 10 }}>
                    {inv.orderId ? (
                      <Link href={`/admin/orders/${inv.orderId}`} style={{ color: '#032b24' }}>
                        {inv.orderId.slice(0, 8)}…
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ padding: 10, textAlign: 'right' }}>{inr(inv.grandTotal)}</td>
                  <td style={{ padding: 10 }}>{inv.status}</td>
                  <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
                    <Link href={`/admin/invoices/${inv.id}`} style={{ marginRight: 12 }}>
                      Edit
                    </Link>
                    <Link href={`/admin/invoices/${inv.id}/print`} style={{ marginRight: 12 }}>
                      Print
                    </Link>
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
