import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import NotifyMeButton from '@/components/store/NotifyMeButton'
import VariantSelector from '@/components/store/VariantSelector'
import MediaGallery from '@/components/store/MediaGallery'
import type { Metadata } from 'next'

export const revalidate = 120

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
  const [product, goldRates] = await Promise.all([
    prisma.product.findUnique({
      where: { id, isActive: true },
      include: {
        variants: {
          select: {
            id: true,
            metalType: true,
            weightGrams: true,
            makingChargePerGram: true,
            flatMakingCharge: true,
            stoneCharges: true,
            miscCharges: true,
            sku: true,
            size: true,
          },
        },
      },
    }),
    prisma.goldRate.findMany(),
  ])

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
        {/* Interactive gallery — images + video, prev/next arrows, thumbnail strip */}
        <MediaGallery media={product.images} productName={product.name} />

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

          {/* Metal variants — interactive selector with price */}
          {product.variants.length > 0 && (
            <VariantSelector
              variants={product.variants.map(v => ({
                ...v,
                weightGrams: v.weightGrams.toString(),
                makingChargePerGram: v.makingChargePerGram.toString(),
                flatMakingCharge: v.flatMakingCharge.toString(),
                stoneCharges: v.stoneCharges.toString(),
                miscCharges: v.miscCharges.toString(),
              }))}
              goldRates={goldRates.map(r => ({
                metalType: r.metalType,
                ratePerGram: r.ratePerGram.toString(),
              }))}
            />
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
          <div className="pt-4 space-y-3">
            {product.comingSoon ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="inline-block bg-brand-dark text-brand-gold text-[9px] tracking-[0.2em] uppercase px-2 py-1 rounded-sm">
                    Coming Soon
                  </span>
                  <span className="text-xs text-gray-400">Pricing not yet available</span>
                </div>
                <NotifyMeButton
                  productId={product.id}
                  productPath={`/shop/product/${product.id}`}
                />
                <p className="text-xs text-gray-400 text-center">
                  Sign in to save this piece — we'll notify you when it's ready to purchase.
                </p>
              </>
            ) : (
              <>
                {/* WhatsApp enquiry — pre-fills product name + item code + URL */}
                <a
                  href={`https://wa.me/917075486464?text=${encodeURIComponent(
                    `Hi! I'm interested in *${product.name}*${product.itemCode ? ` (Code: ${product.itemCode})` : ''} from VAIRIS. Could you please share the price and availability?\n\nProduct: ${process.env.NEXT_PUBLIC_APP_URL}/shop/product/${product.id}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-brand-dark text-white text-sm tracking-[0.2em] uppercase hover:bg-[#1a3a28] transition-colors flex items-center justify-center gap-2.5"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Enquire for Price
                </a>
                {/* Wishlist — available for all products when logged in */}
                <NotifyMeButton
                  productId={product.id}
                  productPath={`/shop/product/${product.id}`}
                  label="Save to Wishlist"
                  savedLabel="✓ Saved to Wishlist"
                />
                <p className="text-xs text-gray-400 text-center">
                  Contact us for pricing and availability
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
