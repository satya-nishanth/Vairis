import Link from 'next/link'
import ProductForm from '@/components/admin/ProductForm'

export default function NewProductPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin/products" className="text-xs text-gray-400 hover:text-brand-gold">
          ← Products
        </Link>
        <h1 className="font-display text-3xl text-gray-900 mt-2">New Product</h1>
      </div>
      <ProductForm mode="create" />
    </div>
  )
}
