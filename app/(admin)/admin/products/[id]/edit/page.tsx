import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPricingConfig } from '@/lib/pricing-data'
import { getStoreCategories } from '@/lib/store-categories'
import { getAllCategoryFilters, getProductLinkedLabels } from '@/lib/category-filters'
import ProductForm from '@/components/admin/ProductForm'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [product, diamondRates, goldRates, pricingConfig, storeCategories, allFilters] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        stones: { orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.diamondRate.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
    getStoreCategories(),
    getAllCategoryFilters(),
  ])

  if (!product) notFound()

  const linkedLabels = getProductLinkedLabels(product, allFilters)

  return (
    <div className="admin-page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
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
        allCategoryFilters={allFilters}
        initialData={{
          id: product.id,
          labels: linkedLabels,
          name: product.name,
          description: product.description,
          category: product.category,
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
          stones: product.stones.map((s) => ({
            diamondRateId: s.diamondRateId,
            caratWeight: s.caratWeight.toString(),
            count: s.count?.toString() ?? '',
            label: s.label ?? '',
          })),
          variants: product.variants.map((v) => ({
            metalType: v.metalType,
            size: v.size ?? '',
            weightGrams: v.weightGrams.toString(),
            makingChargePerGram: v.makingChargePerGram.toString(),
            flatMakingCharge: v.flatMakingCharge.toString(),
            stoneCharges: v.stoneCharges.toString(),
            miscCharges: v.miscCharges.toString(),
            stock: v.stock.toString(),
            sku: v.sku,
          })),
        }}
      />
    </div>
  )
}
