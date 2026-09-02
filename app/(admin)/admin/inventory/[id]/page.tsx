import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { InventoryItemForm } from '@/components/admin/InventoryItemForm'

export const dynamic = 'force-dynamic'

async function loadVariantOptions() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { variants: { orderBy: { metalType: 'asc' } } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })
  return products.flatMap((p) =>
    p.variants.map((v) => ({
      variantId: v.id,
      productId: p.id,
      sku: v.sku,
      label: `${p.name} — ${v.metalType}${v.size ? ` · ${v.size}` : ''} (${v.sku})`,
    })),
  )
}

export default async function EditInventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [row, holders, variantOptions] = await Promise.all([
    prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        product: { select: { name: true } },
        variant: { select: { sku: true, metalType: true, size: true } },
        allocations: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            order: { select: { id: true, contactName: true, status: true } },
          },
        },
      },
    }),
    prisma.inventoryHolder.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    loadVariantOptions(),
  ])
  if (!row) notFound()

  const initial = {
    id: row.id,
    qtyOnHand: row.qtyOnHand,
    unitPrice: row.unitPrice != null ? Number(row.unitPrice) : null,
    customName: row.customName,
    customDescription: row.customDescription,
    metalPurity: row.metalPurity,
    weightGrams: row.weightGrams?.toString() ?? null,
    notes: row.notes,
    holderId: row.holderId,
    variantId: row.variantId,
    product: row.product,
    variant: row.variant,
    allocations: row.allocations.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  }

  return (
    <div className="admin-page admin-page--inventory">
      <h1 className="admin-page__title">Edit inventory</h1>
      <InventoryItemForm holders={holders} variantOptions={variantOptions} initial={initial} />
    </div>
  )
}
