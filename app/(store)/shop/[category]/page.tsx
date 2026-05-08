import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ProductCard from '@/components/store/ProductCard'
import type { Metadata } from 'next'

export const revalidate = 60

const CATEGORY_MAP: Record<string, string> = {
  rings: 'RINGS',
  earrings: 'EARRINGS',
  pendants: 'PENDANTS',
  bracelets: 'BRACELETS',
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
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const label = CATEGORY_LABELS[CATEGORY_MAP[category] ?? ''] ?? 'Collection'
  return {
    title: `${label} — Vairis Fine Jewellery`,
    description: `Shop our ${label.toLowerCase()} collection. Crafted with precision.`,
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const dbCategory = CATEGORY_MAP[category.toLowerCase()]
  if (!dbCategory) notFound()

  const products = await prisma.product.findMany({
    where: { isActive: true, category: dbCategory as any },
    orderBy: { createdAt: 'desc' },
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

  const label = CATEGORY_LABELS[dbCategory]

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-14">
      <div className="text-center mb-12">
        <p className="text-xs text-brand-gold/60 tracking-[0.4em] uppercase mb-2">Collection</p>
        <h1 className="font-display text-3xl md:text-5xl text-gray-900">{label}</h1>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-display text-3xl text-gray-300 mb-3">Coming Soon</p>
          <p className="text-sm text-gray-400">New {label.toLowerCase()} are being added.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
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
      )}
    </div>
  )
}
