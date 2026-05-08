import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: { variants: true },
  })

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl text-gray-900">Products</h1>
        <Link
          href="/admin/products/new"
          className="px-6 py-2.5 bg-brand-dark text-white text-sm tracking-widest uppercase hover:bg-brand-light transition-colors"
        >
          + New Product
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="font-display text-2xl mb-2">No products yet</p>
          <Link href="/admin/products/new" className="text-sm text-brand-gold hover:underline">
            Add your first product →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">Product</th>
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">Category</th>
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">Item Code</th>
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">Variants</th>
                <th className="text-left px-6 py-3 text-xs text-gray-400 tracking-widest uppercase font-medium">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-brand-cream rounded flex-shrink-0 overflow-hidden relative">
                        {p.images[0] ? (
                          <Image src={p.images[0]} alt={p.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-brand-gold/30 font-display text-lg">V</div>
                        )}
                      </div>
                      <span className="font-medium text-sm text-gray-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {p.category.charAt(0) + p.category.slice(1).toLowerCase()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400 font-mono">{p.itemCode ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.variants.length}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.isActive ? 'Active' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/products/${p.id}/edit`} className="text-xs text-brand-gold hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
