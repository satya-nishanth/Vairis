import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { blankPayload } from '@/lib/invoice-document'
import { invoiceFromOrderId, loadInvoiceCatalogue } from '@/lib/invoice-build'
import { InvoiceComposer } from '@/components/admin/InvoiceComposer'

export const dynamic = 'force-dynamic'

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; addVariant?: string }>
}) {
  const { orderId, addVariant } = await searchParams

  const [built, catalogue] = await Promise.all([
    orderId ? invoiceFromOrderId(orderId) : Promise.resolve(null),
    loadInvoiceCatalogue(),
  ])
  const payload = built?.payload ?? blankPayload()

  const recentOrders = await prisma.order.findMany({
    where: { parentOrderId: null },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, contactName: true, status: true, grandTotal: true, createdAt: true },
  })

  return (
    <div className="admin-page" style={{ maxWidth: 1100 }}>
      <p style={{ marginBottom: 12, fontSize: '0.8125rem' }}>
        <Link href="/admin/invoices" style={{ color: '#032b24' }}>
          ← Invoices
        </Link>
      </p>
      <h1 className="admin-page__title">New invoice</h1>

      {!orderId && (
        <div className="inv-composer__line" style={{ marginBottom: 16 }}>
          <p style={{ marginTop: 0, fontSize: '0.875rem' }}>Start from a recent order, or fill a blank invoice below.</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.875rem' }}>
            {recentOrders.map((o) => (
              <li key={o.id} style={{ marginBottom: 6 }}>
                <Link href={`/admin/invoices/new?orderId=${o.id}`}>
                  {o.contactName || o.id} · {o.status} · ₹{Number(o.grandTotal).toLocaleString('en-IN')}
                </Link>
              </li>
            ))}
            {recentOrders.length === 0 && <li>No orders yet — use the blank form.</li>}
          </ul>
        </div>
      )}

      <InvoiceComposer
        initial={payload}
        orderId={orderId ?? null}
        catalogue={catalogue}
        returnPath={orderId ? `/admin/invoices/new?orderId=${orderId}` : '/admin/invoices/new'}
        addVariantId={addVariant ?? null}
      />
    </div>
  )
}
