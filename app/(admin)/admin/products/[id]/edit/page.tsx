import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPricingConfig } from '@/lib/pricing-data'
import ProductForm from '@/components/admin/ProductForm'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [product, diamondRates, goldRates, pricingConfig] = await Promise.all([
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
  ])

  if (!product) notFound()

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
