import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ProductCard from '@/components/store/ProductCard'

export const revalidate = 120

const FILTERS = [
  { label: 'All', href: '/shop' },
  { label: 'Rings', href: '/shop/rings' },
  { label: 'Earrings', href: '/shop/earrings' },
  { label: 'Pendants', href: '/shop/pendants' },
  { label: 'Bracelets', href: '/shop/bracelets' },
]

export default async function ShopPage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      itemCode: true,
      category: true,
      images: true,
      stoneType: true,
      caratWeight: true,
      comingSoon: true,
    },
  })

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-14">
      <div className="text-center mb-12">
        <p className="text-xs text-brand-gold/60 tracking-[0.4em] uppercase mb-2">Collections</p>
        <h1 className="font-display text-3xl md:text-5xl text-gray-900">All</h1>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-12">
        {FILTERS.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={`px-6 py-2 text-xs border tracking-[0.15em] uppercase transition-all ${
              f.href === '/shop'
                ? 'bg-brand-dark text-white border-brand-dark'
                : 'border-gray-200 text-gray-600 hover:border-brand-gold hover:text-brand-gold'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-display text-3xl text-gray-300 mb-3">Coming Soon</p>
          <p className="text-sm text-gray-400">New pieces are being added to this collection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {products.map((p, i) => (
            <ProductCard
              key={p.id}
              id={p.id}
              name={p.name}
              itemCode={p.itemCode}
              category={p.category}
              images={p.images}
              stoneType={p.stoneType}
              caratWeight={p.caratWeight?.toString() ?? null}
              comingSoon={p.comingSoon}
              priority={i < 4}
            />
          ))}
        </div>
      )}
    </div>
  )
}
