import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inventoryDisplayName, isInventorySellable } from '@/lib/inventory'
import { computeVariantLiveUnitPrice } from '@/lib/inventory-pricing'
import { getPricingConfig } from '@/lib/pricing-data'

export const dynamic = 'force-dynamic'

/** Stock available for manual order picker (linked variant + qty > 0). */
export async function GET() {
  await requireAdmin()

  const [rows, goldRates, pricingConfig] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { qtyOnHand: { gt: 0 }, variantId: { not: null } },
      include: {
        holder: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, itemCode: true } },
        variant: {
          include: {
            product: { include: { stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } } } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
  ])

  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))

  const payload = rows
    .filter((r) => isInventorySellable(r) && r.variant)
    .map((r) => {
      const v = r.variant!
      const suggested =
        computeVariantLiveUnitPrice(v, rateMap[v.metalType], pricingConfig) ?? 0
      return {
        inventoryItemId: r.id,
        variantId: v.id,
        productId: v.productId,
        qtyOnHand: r.qtyOnHand,
        holderName: r.holder.name,
        holderId: r.holder.id,
        label: inventoryDisplayName(r),
        sku: v.sku,
        itemCode: r.product?.itemCode ?? '',
        suggestedPrice: suggested,
      }
    })

  return NextResponse.json(payload)
}
