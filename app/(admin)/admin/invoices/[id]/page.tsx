import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { InvoiceComposer } from '@/components/admin/InvoiceComposer'
import type { InvoicePayload } from '@/lib/invoice-document'

export const dynamic = 'force-dynamic'

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) notFound()

  return (
    <div className="admin-page" style={{ maxWidth: 1100 }}>
      <p style={{ marginBottom: 12, fontSize: '0.8125rem' }}>
        <Link href="/admin/invoices" style={{ color: '#032b24' }}>
          ← Invoices
        </Link>
      </p>
      <h1 className="admin-page__title">{invoice.number}</h1>
      <InvoiceComposer
        initial={invoice.payload as InvoicePayload}
        invoiceId={invoice.id}
        number={invoice.number}
        orderId={invoice.orderId}
      />
    </div>
  )
}
