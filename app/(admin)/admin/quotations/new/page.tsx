import { prisma } from '@/lib/prisma'
import { QuotationForm } from './QuotationForm'

export const dynamic = 'force-dynamic'

export default async function NewQuotationPage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, itemCode: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="admin-page" style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        New Quotation
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        For an offline/WhatsApp quote request. This creates a Discord thread in
        #quote-requests-offline and starts reminding the assignee until it&apos;s marked quoted.
      </p>
      <QuotationForm products={products} />
    </div>
  )
}
