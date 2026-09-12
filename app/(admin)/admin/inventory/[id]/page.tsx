import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { isFinanceEmail } from '@/lib/finance-auth'
import { inventoryItemInclude } from '@/lib/inventory'
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
      metalType: v.metalType,
      weightGrams: Number(v.weightGrams),
      label: `${p.name} — ${v.metalType}${v.size ? ` · ${v.size}` : ''} (${v.sku})`,
    })),
  )
}

export default async function EditInventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const isFinance = isFinanceEmail(session.user.email)
  const { id } = await params
  const [row, holders, variantOptions] = await Promise.all([
    prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        ...inventoryItemInclude,
        product: { select: { name: true } },
        variant: { select: { sku: true, metalType: true, size: true, weightGrams: true } },
        allocations: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            order: { select: { id: true, contactName: true, status: true } },
          },
        },
        sales: {
          orderBy: { soldAt: 'desc' },
          take: 20,
          include: {
            order: { select: { id: true, contactName: true } },
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
    purchasePrice: isFinance && row.purchasePrice != null ? Number(row.purchasePrice) : null,
    soldPrice: row.soldPrice != null ? Number(row.soldPrice) : null,
    potentialPrice: isFinance && row.potentialPrice != null ? Number(row.potentialPrice) : null,
    customName: row.customName,
    customDescription: row.customDescription,
    metalPurity: row.metalPurity,
    weightGrams: row.weightGrams?.toString() ?? null,
    diamondCarats: row.diamondCarats != null ? Number(row.diamondCarats) : null,
    stoneCarats: row.stoneCarats != null ? Number(row.stoneCarats) : null,
    notes: row.notes,
    holderId: row.holderId,
    variantId: row.variantId,
    product: row.product,
    variant: row.variant
      ? {
          sku: row.variant.sku,
          metalType: row.variant.metalType,
          size: row.variant.size,
          weightGrams: Number(row.variant.weightGrams),
        }
      : null,
    purchaseBills: (row.purchaseBills ?? []).map((l) => {
      const lineSummary =
        l.purchaseBill.lines && l.purchaseBill.lines.length > 0
          ? l.purchaseBill.lines
              .map((x) => x.description.trim())
              .filter(Boolean)
              .slice(0, 3)
              .join(' · ')
          : ''
      const description = l.purchaseBill.description.trim() || lineSummary || undefined
      const date = l.purchaseBill.date
      const dateLabel = date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      return {
        id: l.purchaseBill.id,
        billNumber: l.purchaseBill.billNumber,
        supplierName: l.purchaseBill.supplierName,
        href: isFinance
          ? `/admin/finance/purchase-bills?edit=${encodeURIComponent(l.purchaseBill.id)}`
          : null,
        dateLabel,
        description,
        ...(isFinance ? { totalAmount: Number(l.purchaseBill.totalAmount) } : {}),
      }
    }),
    allocations: row.allocations.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    sales: row.sales.map((s) => ({
      id: s.id,
      qty: s.qty,
      soldAt: s.soldAt.toISOString(),
      unlinkedOrderLabel: s.unlinkedOrderLabel,
      order: s.order,
    })),
  }

  return (
    <div className="admin-page admin-page--inventory">
      <h1 className="admin-page__title">Edit inventory</h1>
      <InventoryItemForm
        holders={holders}
        variantOptions={variantOptions}
        initial={initial}
        isFinance={isFinance}
      />
    </div>
  )
}
