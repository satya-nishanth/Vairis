import Link from 'next/link'
import Navbar from '@/components/store/Navbar'
import ProductCard from '@/components/store/ProductCard'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

const CATEGORIES = [
  {
    id: 'rings',
    label: 'Rings',
    desc: 'Timeless bands & solitaires',
    grad: 'from-[#1a0a00] to-[#3d2400]',
  },
  {
    id: 'earrings',
    label: 'Earrings',
    desc: 'Studs, hoops & drops',
    grad: 'from-[#0a1a0e] to-[#0f2418]',
  },
  {
    id: 'pendants',
    label: 'Pendants',
    desc: 'Elegant statement pieces',
    grad: 'from-[#0d0a1a] to-[#1a1035]',
  },
  {
    id: 'bracelets',
    label: 'Bracelets',
    desc: 'Chains, bangles & tennis',
    grad: 'from-[#1a0a0e] to-[#2d0f18]',
  },
]

async function getFeatured() {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      name: true,
      itemCode: true,
      category: true,
      images: true,
      stoneType: true,
      caratWeight: true,
    },
  })
}

export default async function HomePage() {
  const products = await getFeatured()

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="bg-brand-dark min-h-[85vh] flex items-center justify-center text-center px-4 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, #c9a84c 0%, transparent 50%), radial-gradient(circle at 80% 20%, #c9a84c 0%, transparent 40%)`,
            }}
          />
          <div className="relative space-y-6 max-w-2xl">
            <p className="text-brand-gold/60 tracking-[0.5em] text-xs uppercase">
              Fine Jewellery
            </p>
            <h1 className="font-display text-7xl md:text-9xl text-white tracking-[0.2em]">
              VAIRIS
            </h1>
            <p className="text-white/50 text-base max-w-sm mx-auto leading-relaxed tracking-wide">
              Every piece tells a story of craftsmanship, precision and timeless beauty.
            </p>
            <div className="flex items-center justify-center gap-6 mt-8">
              <Link
                href="/shop"
                className="px-10 py-3.5 border border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-brand-dark transition-all duration-300 tracking-[0.2em] text-xs uppercase"
              >
                Explore Collection
              </Link>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <p className="text-xs text-brand-gold/60 tracking-[0.4em] uppercase mb-3">Collections</p>
            <h2 className="font-display text-4xl text-gray-900">Shop by Category</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href={`/shop/${cat.id}`}
                className={`group relative aspect-[3/4] bg-gradient-to-br ${cat.grad} overflow-hidden rounded-sm`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <h3 className="font-display text-2xl group-hover:text-brand-gold transition-colors duration-300">
                    {cat.label}
                  </h3>
                  <p className="text-xs text-white/50 mt-1 group-hover:text-white/70 transition-colors">
                    {cat.desc}
                  </p>
                </div>
                <div className="absolute inset-0 border border-white/0 group-hover:border-brand-gold/30 transition-colors duration-300 rounded-sm" />
              </Link>
            ))}
          </div>
        </section>

        {/* New Arrivals */}
        {products.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 pb-24">
            <div className="text-center mb-14">
              <p className="text-xs text-brand-gold/60 tracking-[0.4em] uppercase mb-3">Latest</p>
              <h2 className="font-display text-4xl text-gray-900">New Arrivals</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  itemCode={p.itemCode}
                  category={p.category}
                  images={p.images}
                  stoneType={p.stoneType}
                  caratWeight={p.caratWeight?.toString() ?? null}
                />
              ))}
            </div>
            <div className="text-center mt-12">
              <Link
                href="/shop"
                className="inline-block px-10 py-3 border border-gray-300 text-sm text-gray-600 hover:border-brand-gold hover:text-brand-gold transition-colors tracking-widest uppercase"
              >
                View All
              </Link>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-brand-dark text-white/40 py-10">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-2">
          <p className="font-display text-brand-gold/60 text-lg tracking-widest">VAIRIS</p>
          <p className="text-sm">Fine Jewellery. Crafted with Precision.</p>
          <p className="text-xs mt-4">© {new Date().getFullYear()} Vairis. All rights reserved.</p>
        </div>
      </footer>
    </>
  )
}
