import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import WishlistRemoveButton from '@/components/store/WishlistRemoveButton'

export const dynamic = 'force-dynamic'

const CATEGORY_LABELS: Record<string, string> = {
  RINGS: 'Rings',
  EARRINGS: 'Earrings',
  PENDANTS: 'Pendants',
  BRACELETS: 'Bracelets',
}

export default async function WishlistPage() {
  const session = await getSession()
  if (!session) redirect('/auth/login?next=/wishlist')

  // Get user from DB
  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  })
  if (!user) redirect('/auth/login?next=/wishlist')

  const items = await prisma.wishlist.findMany({
    where: { userId: user.id },
    include: {
      product: {
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
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-16">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl text-brand-gold/60">♡</span>
          <h1 className="font-display text-4xl text-gray-900">My Wishlist</h1>
        </div>
        <p className="text-sm text-gray-400 ml-11">
          {items.length === 0
            ? 'No saved pieces yet'
            : `${items.length} coming-soon ${items.length === 1 ? 'piece' : 'pieces'} you've saved`}
        </p>
      </div>

      {items.length === 0 ? (
        /* Empty state */
        <div className="text-center py-24 space-y-4">
          <div className="text-6xl text-gray-100 select-none">♡</div>
          <p className="font-display text-2xl text-gray-300">Nothing saved yet</p>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">
            When a piece catches your eye and isn't available yet, save it here — we'll let you know
            when it's ready.
          </p>
          <Link
            href="/shop"
            className="inline-block mt-6 px-8 py-3 border border-brand-gold text-brand-gold text-sm tracking-widest uppercase hover:bg-brand-gold hover:text-brand-dark transition-all"
          >
            Browse Collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {items.map(({ product }) => {
            const img = product.images[0]
            return (
              <div key={product.id} className="group relative">
                {/* Image */}
                <Link href={`/shop/product/${product.id}`}>
                  <div className="aspect-square bg-brand-cream overflow-hidden relative rounded-sm">
                    {img ? (
                      <Image
                        src={img}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-cream to-[#f0ebe3]">
                        <span className="font-display text-5xl text-brand-gold/20">V</span>
                      </div>
                    )}
                    {/* Coming Soon badge */}
                    <div className="absolute top-2 left-2 bg-brand-dark/90 text-brand-gold text-[9px] tracking-[0.2em] uppercase px-2 py-1 rounded-sm">
                      Coming Soon
                    </div>
                  </div>
                </Link>

                {/* Info */}
                <div className="mt-3 space-y-0.5">
                  <p className="text-[10px] text-brand-gold/60 tracking-[0.2em] uppercase">
                    {CATEGORY_LABELS[product.category] ?? product.category}
                  </p>
                  <Link href={`/shop/product/${product.id}`}>
                    <h3 className="font-display text-base text-gray-900 leading-snug hover:text-brand-dark transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  {product.itemCode && (
                    <p className="text-xs text-gray-400 font-mono">{product.itemCode}</p>
                  )}
                  {product.stoneType && product.caratWeight && (
                    <p className="text-xs text-gray-500">
                      {product.caratWeight.toString()}ctw {product.stoneType}
                    </p>
                  )}
                </div>

                {/* Remove button */}
                <WishlistRemoveButton productId={product.id} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
