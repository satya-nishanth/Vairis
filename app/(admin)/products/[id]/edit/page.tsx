import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ProductForm from '@/components/admin/ProductForm'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: true },
  })

  if (!product) notFound()

  const formData = {
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
    variants: product.variants.map((v) => ({
      metalType: v.metalType,
      weightGrams: v.weightGrams.toString(),
      stock: v.stock.toString(),
      sku: v.sku,
    })),
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin/products" className="text-xs text-gray-400 hover:text-brand-gold">
          ← Products
        </Link>
        <h1 className="font-display text-3xl text-gray-900 mt-2">Edit Product</h1>
        <p className="text-sm text-gray-400 mt-0.5">{product.name}</p>
      </div>
      <ProductForm mode="edit" initialData={formData} />
    </div>
  )
}
