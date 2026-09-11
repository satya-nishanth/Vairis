import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { isFinanceEmail } from '@/lib/finance-auth'
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

export default async function NewInventoryPage() {
  const session = await requireAdmin()
  const isFinance = isFinanceEmail(session.user.email)
  const [holders, variantOptions] = await Promise.all([
    prisma.inventoryHolder.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    loadVariantOptions(),
  ])

  return (
    <div className="admin-page admin-page--inventory">
      <h1 className="admin-page__title">Add inventory</h1>
      <InventoryItemForm
        holders={holders}
        variantOptions={variantOptions}
        isFinance={isFinance}
      />
    </div>
  )
}
