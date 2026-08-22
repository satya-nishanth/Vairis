import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { InvoiceComposer } from '@/components/admin/InvoiceComposer'
import { loadInvoiceCatalogue } from '@/lib/invoice-build'
import type { InvoicePayload } from '@/lib/invoice-document'

export const dynamic = 'force-dynamic'

export default async function EditInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ addVariant?: string }>
}) {
  const { id } = await params
  const { addVariant } = await searchParams
  const [invoice, catalogue] = await Promise.all([
    prisma.invoice.findUnique({ where: { id } }),
    loadInvoiceCatalogue(),
  ])
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
        catalogue={catalogue}
        returnPath={`/admin/invoices/${invoice.id}`}
        addVariantId={addVariant ?? null}
      />
    </div>
  )
}
