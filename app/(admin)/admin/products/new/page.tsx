import Link from 'next/link'
import ProductForm from '@/components/admin/ProductForm'
import type { Category } from '@prisma/client'

const VALID: Category[] = ['RINGS', 'EARRINGS', 'PENDANTS', 'BRACELETS', 'NECKLACES']

type PageProps = {
  searchParams: Promise<{ category?: string }>
}

export default async function NewProductPage({ searchParams }: PageProps) {
  const params = await searchParams
  const raw = (params.category ?? '').toUpperCase()
  const category = VALID.includes(raw as Category) ? (raw as Category) : 'RINGS'

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/products" style={{ fontSize: '0.75rem', color: '#9ca3af', textDecoration: 'none' }}>
          ← Products
        </Link>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginTop: '0.5rem' }}>
          New Product
        </h1>
      </div>
      <ProductForm mode="create" initialData={{ category }} />
    </div>
  )
}
