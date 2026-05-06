import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function AdminDashboard() {
  const [totalProducts, activeProducts, categories] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.groupBy({
      by: ['category'],
      _count: { id: true },
    }),
  ])

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl text-gray-900 mb-8">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-10">
        <div className="bg-white border border-gray-100 rounded-lg p-6">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Total Products</p>
          <p className="font-display text-4xl text-gray-900">{totalProducts}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-6">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Active</p>
          <p className="font-display text-4xl text-brand-gold">{activeProducts}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-lg p-6">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Categories</p>
          <p className="font-display text-4xl text-gray-900">{categories.length}</p>
        </div>
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-lg p-6 mb-10">
          <h2 className="text-sm font-medium text-gray-600 tracking-widest uppercase mb-4">By Category</h2>
          <div className="space-y-3">
            {categories.map((c) => (
              <div key={c.category} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">
                  {c.category.charAt(0) + c.category.slice(1).toLowerCase()}
                </span>
                <span className="text-sm font-medium text-gray-900">{c._count.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/admin/products/new"
        className="inline-block px-8 py-3 bg-brand-dark text-white text-sm tracking-widest uppercase hover:bg-brand-light transition-colors"
      >
        + Add Product
      </Link>
    </div>
  )
}
