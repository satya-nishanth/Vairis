import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

export const revalidate = 60

const METAL_LABELS: Record<string, string> = {
  GOLD_18K: '18kt Gold',
  GOLD_22K: '22kt Gold',
  SILVER_925: 'Silver 925',
  ROSE_GOLD: 'Rose Gold 18kt',
}

const CATEGORY_LABELS: Record<string, string> = {
  RINGS: 'Rings',
  EARRINGS: 'Earrings',
  PENDANTS: 'Pendants',
  BRACELETS: 'Bracelets',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id, isActive: true },
    select: { name: true, description: true, images: true },
  })
  if (!product) return {}
  return {
    title: `${product.name} — Vairis Fine Jewellery`,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: product.images[0] ? [product.images[0]] : [],
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id, isActive: true },
    include: {
      variants: {
        select: { id: true, metalType: true, weightGrams: true, sku: true },
      },
    },
  })

  if (!product) notFound()

  const hasSpecs =
    product.totalLengthMm ||
    product.motifSizeMm ||
    product.thicknessMm

  const hasGemstone =
    product.stoneType ||
    product.gemCount ||
    product.caratWeight

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-12">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-8">
        <Link href="/shop" className="hover:text-brand-gold">Shop</Link>
        <span>/</span>
        <Link
          href={`/shop/${product.category.toLowerCase()}`}
          className="hover:text-brand-gold"
        >
          {CATEGORY_LABELS[product.category]}
        </Link>
        <span>/</span>
        <span className="text-gray-600">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 lg:gap-20">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square bg-brand-cream rounded-sm overflow-hidden relative">
            {product.images[0] ? (
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-display text-8xl text-brand-gold/10">V</span>
              </div>
            )}
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(1, 5).map((img, i) => (
                <div key={i} className="aspect-square bg-brand-cream rounded-sm overflow-hidden relative">
                  <Image
                    src={img}
                    alt={`${product.name} ${i + 2}`}
                    fill
                    sizes="20vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          {product.itemCode && (
            <p className="text-xs text-gray-400 font-mono tracking-widest uppercase">
              {product.itemCode}
            </p>
          )}

          <div>
            <h1 className="font-display text-2xl md:text-4xl text-gray-900 leading-tight">{product.name}</h1>
            <p className="text-sm text-brand-gold/70 mt-1 tracking-widest uppercase">
              {CATEGORY_LABELS[product.category]}
            </p>
          </div>

          {product.designStyle && (
            <p className="text-sm text-gray-500 leading-relaxed italic border-l-2 border-brand-gold/30 pl-4">
              {product.designStyle}
            </p>
          )}

          {product.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
          )}

          <hr className="border-gray-100" />

          {/* Metal variants */}
          {product.variants.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 tracking-[0.2em] uppercase mb-3">
                Available In
              </p>
              <div className="space-y-2">
                {product.variants.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between px-4 py-3 border border-gray-100 rounded-sm hover:border-brand-gold/40 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {METAL_LABELS[v.metalType] ?? v.metalType}
                    </span>
                    <span className="text-sm text-gray-500">
                      {parseFloat(v.weightGrams.toString()).toFixed(3)}g
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Design specs */}
          {hasSpecs && (
            <div>
              <p className="text-xs text-gray-400 tracking-[0.2em] uppercase mb-3">
                Design Specifications
              </p>
              <div className="grid grid-cols-3 gap-3">
                {product.totalLengthMm && (
                  <div className="bg-gray-50 rounded-sm p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">Length</p>
                    <p className="text-sm font-medium text-gray-900">
                      {parseFloat(product.totalLengthMm.toString())}mm
                    </p>
                  </div>
                )}
                {product.motifSizeMm && (
                  <div className="bg-gray-50 rounded-sm p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">Motif</p>
                    <p className="text-sm font-medium text-gray-900">
                      {parseFloat(product.motifSizeMm.toString())}mm
                    </p>
                  </div>
                )}
                {product.thicknessMm && (
                  <div className="bg-gray-50 rounded-sm p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">Depth</p>
                    <p className="text-sm font-medium text-gray-900">
                      {parseFloat(product.thicknessMm.toString())}mm
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gemstone */}
          {hasGemstone && (
            <div>
              <p className="text-xs text-gray-400 tracking-[0.2em] uppercase mb-3">
                Gemstone Details
              </p>
              <div className="bg-gray-50 rounded-sm overflow-hidden">
                {[
                  product.stoneType && { label: 'Stone Type', value: product.stoneType },
                  product.stoneShape && { label: 'Stone Shape', value: product.stoneShape },
                  product.stoneDimMm && { label: 'Dimensions', value: `${product.stoneDimMm} mm` },
                  product.gemCount && { label: 'Gem Count', value: String(product.gemCount) },
                  product.caratWeight && {
                    label: 'Total Carat Weight',
                    value: `${parseFloat(product.caratWeight.toString())} ctw`,
                  },
                ]
                  .filter(Boolean)
                  .map((row: any) => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-2.5 border-b border-white last:border-0">
                      <span className="text-xs text-gray-500">{row.label}</span>
                      <span className="text-xs font-medium text-gray-900">{row.value}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="pt-4">
            <button
              className="w-full py-4 bg-brand-dark text-white text-sm tracking-[0.2em] uppercase hover:bg-brand-light transition-colors"
            >
              Enquire for Price
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              Contact us for pricing and availability
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
