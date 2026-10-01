import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPricingConfig } from '@/lib/pricing-data'
import { getStoreCategories } from '@/lib/store-categories'
import ProductForm from '@/components/admin/ProductForm'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [product, diamondRates, goldRates, pricingConfig, storeCategories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        pieces: {
          orderBy: { sortOrder: 'asc' },
          include: {
            variants: true,
            stones: { orderBy: { sortOrder: 'asc' }, include: { diamondRate: true } },
          },
        },
        variants: true,
        stones: { orderBy: { sortOrder: 'asc' }, include: { diamondRate: true } },
        storeCategories: {
          include: { category: { select: { slug: true } } },
          take: 1,
        },
      },
    }),
    prisma.diamondRate.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
    getStoreCategories(),
  ])

  if (!product) notFound()

  // Prefer StoreCategory join slug so custom cats don't show as PENDANTS in the form.
  const storeSlug = product.storeCategories[0]?.category?.slug
  const formCategory = storeSlug
    ? storeSlug.toUpperCase().replace(/-/g, '_')
    : product.category

  const mapStone = (s: (typeof product.stones)[number]) => {
    const useStore = s.ratePerCarat == null && s.ratePerCaratExchange == null
    return {
      diamondRateId: s.diamondRateId,
      caratWeight: s.caratWeight.toString(),
      count: s.count?.toString() ?? '',
      label: s.label ?? '',
      useStoreRates: useStore,
      ratePerCarat: useStore
        ? String(s.diamondRate.ratePerCarat)
        : String(s.ratePerCarat),
      ratePerCaratExchange: useStore
        ? String(s.diamondRate.ratePerCaratExchange)
        : String(s.ratePerCaratExchange),
    }
  }

  const mapVariant = (v: (typeof product.variants)[number]) => ({
    metalType: v.metalType,
    size: v.size ?? '',
    weightGrams: v.weightGrams.toString(),
    makingChargePerGram: v.makingChargePerGram.toString(),
    flatMakingCharge: v.flatMakingCharge.toString(),
    stoneCharges: v.stoneCharges.toString(),
    miscCharges: v.miscCharges.toString(),
    stock: v.stock.toString(),
    sku: v.sku,
  })

  const pieces =
    product.pieces.length > 0
      ? product.pieces.map((p) => {
          const inherit = p.vaGoldPct == null && p.vaLabel == null
          return {
            key: p.id,
            id: p.id,
            name: p.name,
            inheritWastage: inherit,
            vaGoldPct:
              p.vaGoldPct != null
                ? String(p.vaGoldPct)
                : product.vaGoldPct != null
                  ? String(product.vaGoldPct)
                  : String(pricingConfig.vaGoldPct),
            vaLabel:
              p.vaLabel ||
              product.vaLabel ||
              pricingConfig.vaLabel ||
              'Value Addition',
            variants: p.variants.map(mapVariant),
            stones: p.stones.map(mapStone),
          }
        })
      : undefined

  return (
    <div className="admin-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/products" style={{ fontSize: '0.75rem', color: '#9ca3af', textDecoration: 'none' }}>
          ← Products
        </Link>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginTop: '0.5rem' }}>Edit Product</h1>
        <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.125rem' }}>{product.name}</p>
      </div>
      <ProductForm
        mode="edit"
        categories={storeCategories.map((c) => ({ slug: c.slug, name: c.name }))}
        diamondRates={diamondRates.map((r) => ({
          id: r.id,
          label: r.label,
          ratePerCarat: Number(r.ratePerCarat),
          ratePerCaratExchange: Number(r.ratePerCaratExchange),
        }))}
        goldRates={Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))}
        pricingConfig={pricingConfig}
        initialData={{
          id: product.id,
          name: product.name,
          description: product.description,
          category: formCategory,
          itemCode: product.itemCode ?? '',
          designStyle: product.designStyle ?? '',
          totalLengthMm: product.totalLengthMm?.toString() ?? '',
          motifSizeMm: product.motifSizeMm?.toString() ?? '',
          thicknessMm: product.thicknessMm?.toString() ?? '',
          stoneType: product.stoneType ?? '',
          stoneShape: product.stoneShape ?? '',
          stoneDimMm: product.stoneDimMm ?? '',
          gemCount: product.gemCount?.toString() ?? '',
          caratWeight: product.caratWeight?.toString() ?? '',
          images: product.images,
          isActive: product.isActive,
          comingSoon: product.comingSoon,
          status: product.status,
          priority: product.priority ?? 0,
          priceVisibility: product.priceVisibility,
          pieces,
          // Legacy fallback when no pieces row yet
          inheritWastage: product.vaGoldPct == null && product.vaLabel == null,
          vaGoldPct: product.vaGoldPct != null ? String(product.vaGoldPct) : undefined,
          vaLabel: product.vaLabel ?? undefined,
          stones: product.stones.map(mapStone),
          variants: product.variants.map(mapVariant),
        }}
      />
    </div>
  )
}
