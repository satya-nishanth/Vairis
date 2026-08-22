import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { InvoicePrintView } from '@/components/admin/InvoicePrintView'
import type { InvoicePayload } from '@/lib/invoice-document'
import { PrintButton } from './PrintButton'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { number: true } })
  return { title: invoice ? `${invoice.number} · Tax Invoice` : 'Tax Invoice' }
}

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) notFound()
  const payload = invoice.payload as InvoicePayload

  return (
    <div className="inv-print-page">
      <div className="inv-print-page__bar">
        <Link href={`/admin/invoices/${invoice.id}`}>← Edit</Link>
        <PrintButton />
      </div>
      <div className="inv-print-page__sheet">
        <InvoicePrintView number={invoice.number} payload={payload} />
        <div className="inv-print-page__footer">
          <span>Vairis · Everyday Diamond Wear</span>
          <span>Computer generated invoice · thevairis.com</span>
        </div>
      </div>
    </div>
  )
}
