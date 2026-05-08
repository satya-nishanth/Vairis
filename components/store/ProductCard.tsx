import Link from 'next/link'
import Image from 'next/image'
import { thumb } from '@/lib/imageUrl'

type ProductCardProps = {
  id: string
  name: string
  itemCode: string | null
  category: string
  images: string[]
  stoneType: string | null
  caratWeight: number | string | null
  comingSoon?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  RINGS: 'Rings',
  EARRINGS: 'Earrings',
  PENDANTS: 'Pendants',
  BRACELETS: 'Bracelets',
}

export default function ProductCard({
  id, name, itemCode, category, images, stoneType, caratWeight, comingSoon,
}: ProductCardProps) {
  const img = images[0]

  return (
    <Link href={`/shop/product/${id}`} className="group block">
      <div className="aspect-square bg-brand-cream overflow-hidden relative rounded-sm">
        {img ? (
          <Image
            src={img}
            alt={name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-brand-cream to-[#f0ebe3]">
            <span className="font-display text-5xl text-brand-gold/20 select-none">V</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
        {comingSoon && (
          <div className="absolute top-2 left-2 bg-brand-dark/90 text-brand-gold text-[9px] tracking-[0.2em] uppercase px-2 py-1 rounded-sm">
            Coming Soon
          </div>
        )}
      </div>

      <div className="mt-3 space-y-0.5">
        <p className="text-[10px] text-brand-gold/60 tracking-[0.2em] uppercase">
          {CATEGORY_LABELS[category] ?? category}
        </p>
        <h3 className="font-display text-base text-gray-900 leading-snug group-hover:text-brand-dark transition-colors">
          {name}
        </h3>
        {itemCode && <p className="text-xs text-gray-400 font-mono">{itemCode}</p>}
        {stoneType && caratWeight && (
          <p className="text-xs text-gray-500">{caratWeight}ctw {stoneType}</p>
        )}
        {comingSoon && (
          <p className="text-xs text-brand-gold/70 tracking-wide">Notify me →</p>
        )}
      </div>
    </Link>
  )
}
