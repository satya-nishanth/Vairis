import { prisma } from '@/lib/prisma'
import { QuotationForm } from './QuotationForm'

export const dynamic = 'force-dynamic'

export default async function NewQuotationPage() {
  const rows = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      itemCode: true,
      category: true,
      variants: { select: { sku: true }, take: 8 },
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  const products = rows.map((p) => ({
    id: p.id,
    name: p.name,
    itemCode: p.itemCode,
    category: p.category,
    skus: p.variants.map((v) => v.sku),
  }))

  return (
    <div className="admin-page admin-page--quotations">
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        New Quotation
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        For an offline/WhatsApp quote request. Creates a Discord notify thread and opens the admin
        desk for estimates.
      </p>
      <QuotationForm products={products} />
    </div>
  )
}
