import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/store/Navbar'
import HeroCarousel from '@/components/store/HeroCarousel'
import ProductCard from '@/components/store/ProductCard'
import { getHeroSlides } from '@/lib/hero-images'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

const CATEGORIES = [
  {
    id: 'rings',
    label: 'Rings',
    desc: 'Timeless bands & solitaires',
    image: '/images/website-assets/category-ring.jpeg',
    focus: 'center',
  },
  {
    id: 'earrings',
    label: 'Earrings',
    desc: 'Studs, hoops & drops',
    image: '/images/website-assets/category-earring.jpeg',
    focus: 'top',
  },
  {
    id: 'pendants',
    label: 'Pendants',
    desc: 'Elegant statement pieces',
    image: '/images/website-assets/category-pendant.jpeg',
    focus: 'top',
  },
  {
    id: 'bracelets',
    label: 'Bracelets',
    desc: 'Chains, bangles & tennis',
    image: '/images/website-assets/category-bracelet.jpeg',
    focus: 'center',
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
      comingSoon: true,
    },
  })
}

export default async function HomePage() {
  const [products, heroSlides] = await Promise.all([
    getFeatured(),
    getHeroSlides(),
  ])

  return (
    <>
      <Navbar />
      <main>
        <HeroCarousel dbSlides={heroSlides} />

        {/* Categories */}
        <section className="bg-brand-cream">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-24">
          <div className="text-center mb-10 md:mb-14">
            <p className="font-display tracking-[0.4em] text-xs uppercase mb-3" style={{ fontWeight: 300, color: '#6b7280' }}>
              Collections
            </p>
            <h2 className="font-display text-gray-800" style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 400, letterSpacing: '0.08em' }}>
              Shop by Category
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href={`/shop/${cat.id}`}
                className="group relative aspect-[3/4] overflow-hidden rounded-sm"
              >
                {/* Real category photo */}
                <Image
                  src={cat.image}
                  alt={cat.label}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  style={{ objectPosition: cat.focus }}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/70" />
                {/* Hover tint */}
                <div className="absolute inset-0 bg-brand-dark/0 group-hover:bg-brand-dark/20 transition-colors duration-400" />
                {/* Text */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 text-white">
                  <h3
                    className="font-display group-hover:text-brand-gold transition-colors duration-300"
                    style={{ fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: 400, letterSpacing: '0.08em' }}
                  >
                    {cat.label}
                  </h3>
                  <p className="text-xs text-white/55 mt-0.5 group-hover:text-white/75 transition-colors tracking-wide">
                    {cat.desc}
                  </p>
                </div>
                {/* Gold border on hover */}
                <div className="absolute inset-0 border border-transparent group-hover:border-brand-gold/40 transition-colors duration-300 rounded-sm" />
              </Link>
            ))}
          </div>
          </div>
        </section>

        {/* New Arrivals */}
        {products.length > 0 && (
          <section className="bg-brand-cream">
          <div className="max-w-7xl mx-auto px-4 md:px-6 pb-12 md:pb-24 pt-12 md:pt-24">
            <div className="text-center mb-10 md:mb-14">
              <p className="font-display tracking-[0.4em] text-xs uppercase mb-3" style={{ fontWeight: 300, color: '#6b7280' }}>
                Latest
              </p>
              <h2
                className="font-display text-gray-800"
                style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 400, letterSpacing: '0.08em' }}
              >
                New Arrivals
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
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
            <div className="text-center mt-12">
              <Link
                href="/shop"
                className="inline-block font-display border border-gray-300 text-gray-600 hover:border-brand-gold hover:text-brand-gold transition-colors"
                style={{ padding: '12px 40px', fontSize: '13px', letterSpacing: '0.3em', fontWeight: 300 }}
              >
                VIEW ALL
              </Link>
            </div>
          </div>
          </section>
        )}
      </main>

      <footer className="bg-brand-dark text-white/40 pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-center mb-8">
            <img src="/images/vairius_logo.png" alt="VAIRIS" style={{ height: '64px', width: 'auto', opacity: 0.8 }} />
          </div>
          <div className="w-full max-w-md mx-auto h-px bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent mb-8" />
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm mb-6">
            <a href="mailto:contact@thevairis.com" className="text-white/50 hover:text-brand-gold transition-colors tracking-wide">contact@thevairis.com</a>
            <span className="hidden md:block text-white/20">·</span>
            <a href="tel:+917075486464" className="text-white/50 hover:text-brand-gold transition-colors tracking-wide">+91 7075 486 464</a>
            <span className="hidden md:block text-white/20">·</span>
            <a href="https://www.instagram.com/vairis.jewellery" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/50 hover:text-brand-gold transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
              </svg>
              @vairis.jewellery
            </a>
          </div>
          <p className="text-center text-xs text-white/20 tracking-widest">© {new Date().getFullYear()} Vairis Fine Jewellery. All rights reserved.</p>
        </div>
      </footer>
    </>
  )
}
