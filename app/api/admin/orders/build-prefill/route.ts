import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { prefillInternalBuild } from '@/lib/order-internal-build'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/orders/build-prefill?variantId=&inventoryItemId=
 * Prefills admin-only order-line build details from catalogue (+ optional inventory).
 */
export async function GET(req: NextRequest) {
  await requireAdmin()

  const variantId = req.nextUrl.searchParams.get('variantId')?.trim()
  const inventoryItemId = req.nextUrl.searchParams.get('inventoryItemId')?.trim() || undefined
  if (!variantId) {
    return NextResponse.json({ error: 'variantId required' }, { status: 400 })
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: {
        include: {
          stones: {
            include: { diamondRate: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })
  if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })

  let inventory = null
  if (inventoryItemId) {
    inventory = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      select: {
        id: true,
        variantId: true,
        weightGrams: true,
        diamondCarats: true,
        stoneCarats: true,
        metalPurity: true,
      },
    })
    if (!inventory) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })
    }
    if (inventory.variantId && inventory.variantId !== variantId) {
      return NextResponse.json(
        { error: 'Inventory item does not match selected variant' },
        { status: 400 },
      )
    }
  }

  const build = prefillInternalBuild(variant, inventory)
  return NextResponse.json({ build })
}
