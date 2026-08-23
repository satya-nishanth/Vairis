import Link from 'next/link'
import ProductForm from '@/components/admin/ProductForm'
import { prisma } from '@/lib/prisma'
import { getPricingConfig } from '@/lib/pricing-data'
import { parseInvoiceReturnTo } from '@/lib/invoice-return'
import type { Category } from '@prisma/client'

export const dynamic = 'force-dynamic'

const VALID: Category[] = ['RINGS', 'EARRINGS', 'PENDANTS', 'BRACELETS', 'NECKLACES']

type PageProps = {
  searchParams: Promise<{ category?: string; returnTo?: string }>
}

export default async function NewProductPage({ searchParams }: PageProps) {
  const params = await searchParams
  const raw = (params.category ?? '').toUpperCase()
  const category = VALID.includes(raw as Category) ? (raw as Category) : 'RINGS'
  const returnTo = parseInvoiceReturnTo(params.returnTo)

  const [diamondRates, goldRates, pricingConfig] = await Promise.all([
    prisma.diamondRate.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
  ])

  return (
    <div className="admin-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href={returnTo ?? '/admin/products'}
          style={{ fontSize: '0.75rem', color: '#9ca3af', textDecoration: 'none' }}
        >
          {returnTo ? '← Invoice' : '← Products'}
        </Link>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginTop: '0.5rem' }}>
          New Product
        </h1>
        {returnTo && (
          <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Saving this product will add it to the invoice and take you back.
          </p>
        )}
      </div>
      <ProductForm
        mode="create"
        initialData={{ category }}
        diamondRates={diamondRates.map((r) => ({
          id: r.id,
          label: r.label,
          ratePerCarat: Number(r.ratePerCarat),
          ratePerCaratExchange: Number(r.ratePerCaratExchange),
        }))}
        goldRates={Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))}
        pricingConfig={pricingConfig}
        returnTo={returnTo}
      />
    </div>
  )
}
