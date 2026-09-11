import type { InventoryItem, Prisma } from '@prisma/client'
import {
  type InventoryAuditActor,
  inventoryItemAuditSnap,
  inventoryItemHref,
  inventoryItemObjectLabel,
  logInventoryAudit,
  summarizeAllocation,
  summarizeSale,
} from '@/lib/inventory-audit'

export { inventoryDisplayName } from '@/lib/inventory-audit'

export class InventoryError extends Error {
  code: 'NOT_FOUND' | 'INSUFFICIENT' | 'NOT_LINKED' | 'VARIANT_MISMATCH'

  constructor(code: InventoryError['code'], message: string) {
    super(message)
    this.code = code
  }
}

export type InventoryItemRow = InventoryItem & {
  holder: { id: string; name: string }
  product: { id: string; name: string; itemCode: string | null } | null
  variant: { id: string; sku: string; metalType: string; size: string | null } | null
  _count?: { allocations: number }
}

export function isInventorySellable(row: { variantId: string | null; qtyOnHand: number }): boolean {
  return row.variantId != null && row.qtyOnHand > 0
}

export async function allocateInventoryForOrderItem(
  tx: Prisma.TransactionClient,
  input: {
    inventoryItemId: string
    orderId: string
    orderItemId: string
    variantId: string
    qty: number
    actor?: InventoryAuditActor
  },
): Promise<void> {
  const item = await tx.inventoryItem.findUnique({
    where: { id: input.inventoryItemId },
    include: {
      holder: { select: { name: true } },
      product: { select: { name: true } },
      variant: { select: { sku: true, metalType: true, size: true } },
    },
  })
  if (!item) throw new InventoryError('NOT_FOUND', 'Inventory item not found')
  if (!item.variantId) {
    throw new InventoryError('NOT_LINKED', 'Link this inventory item to a catalogue variant before selling')
  }
  if (item.variantId !== input.variantId) {
    throw new InventoryError('VARIANT_MISMATCH', 'Inventory item does not match the order line variant')
  }
  if (item.qtyOnHand < input.qty) {
    throw new InventoryError('INSUFFICIENT', `Only ${item.qtyOnHand} unit(s) available in inventory`)
  }

  const updated = await tx.inventoryItem.updateMany({
    where: { id: input.inventoryItemId, qtyOnHand: { gte: input.qty } },
    data: { qtyOnHand: { decrement: input.qty } },
  })
  if (updated.count === 0) {
    throw new InventoryError('INSUFFICIENT', 'Insufficient inventory (updated concurrently)')
  }

  await tx.inventoryAllocation.create({
    data: {
      inventoryItemId: input.inventoryItemId,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      qty: input.qty,
    },
  })

  if (input.actor) {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: { contactName: true },
    })
    const beforeSnap = inventoryItemAuditSnap({ ...item, qtyOnHand: item.qtyOnHand })
    const afterSnap = inventoryItemAuditSnap({ ...item, qtyOnHand: item.qtyOnHand - input.qty })
    const label = inventoryItemObjectLabel(item)
    await logInventoryAudit({
      actor: input.actor,
      action: 'ALLOCATE',
      entityType: 'ALLOCATION',
      entityId: input.orderItemId,
      objectLabel: label,
      objectHref: inventoryItemHref(item.id),
      summary: summarizeAllocation({
        qty: input.qty,
        itemLabel: label,
        orderContactName: order?.contactName ?? 'Manual order',
        qtyAfter: afterSnap.qtyOnHand,
      }),
      before: beforeSnap,
      after: afterSnap,
      tx,
    })
  }
}

export async function markInventorySold(
  tx: Prisma.TransactionClient,
  input: {
    inventoryItemId: string
    qty: number
    orderId?: string | null
    unlinkedOrderLabel?: string | null
    actor?: InventoryAuditActor
  },
): Promise<void> {
  const orderId = input.orderId?.trim() || null
  const unlinkedOrderLabel = input.unlinkedOrderLabel?.trim() || null
  if (!orderId && !unlinkedOrderLabel) {
    throw new InventoryError('NOT_LINKED', 'Link to an order or add a text reference')
  }
  if (orderId && unlinkedOrderLabel) {
    throw new InventoryError('NOT_LINKED', 'Use either an order link or a text reference, not both')
  }

  const item = await tx.inventoryItem.findUnique({
    where: { id: input.inventoryItemId },
    include: {
      holder: { select: { name: true } },
      product: { select: { name: true } },
      variant: { select: { sku: true, metalType: true, size: true } },
    },
  })
  if (!item) throw new InventoryError('NOT_FOUND', 'Inventory item not found')
  if (input.qty <= 0 || input.qty > item.qtyOnHand) {
    throw new InventoryError('INSUFFICIENT', `Only ${item.qtyOnHand} unit(s) available to mark sold`)
  }

  if (orderId) {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } })
    if (!order) throw new InventoryError('NOT_FOUND', 'Order not found')
  }

  const updated = await tx.inventoryItem.updateMany({
    where: { id: input.inventoryItemId, qtyOnHand: { gte: input.qty } },
    data: { qtyOnHand: { decrement: input.qty } },
  })
  if (updated.count === 0) {
    throw new InventoryError('INSUFFICIENT', 'Insufficient inventory (updated concurrently)')
  }

  const sale = await tx.inventorySale.create({
    data: {
      inventoryItemId: input.inventoryItemId,
      qty: input.qty,
      orderId,
      unlinkedOrderLabel,
    },
    include: {
      order: { select: { id: true, contactName: true } },
    },
  })

  if (input.actor) {
    const beforeSnap = inventoryItemAuditSnap({ ...item, qtyOnHand: item.qtyOnHand })
    const afterSnap = inventoryItemAuditSnap({ ...item, qtyOnHand: item.qtyOnHand - input.qty })
    const label = inventoryItemObjectLabel(item)
    const orderLabel = sale.order
      ? `order ${sale.order.contactName}`
      : `“${unlinkedOrderLabel}” (not linked)`
    await logInventoryAudit({
      actor: input.actor,
      action: 'SOLD',
      entityType: 'SALE',
      entityId: sale.id,
      objectLabel: label,
      objectHref: inventoryItemHref(item.id),
      summary: summarizeSale({
        qty: input.qty,
        itemLabel: label,
        orderLabel,
        qtyAfter: afterSnap.qtyOnHand,
      }),
      before: beforeSnap,
      after: afterSnap,
      tx,
    })
  }
}

export const inventoryItemInclude = {
  holder: { select: { id: true, name: true } },
  product: { select: { id: true, name: true, itemCode: true } },
  variant: { select: { id: true, sku: true, metalType: true, size: true } },
  purchaseBills: {
    select: {
      purchaseBillId: true,
      purchaseBill: {
        select: {
          id: true,
          billNumber: true,
          supplierName: true,
          date: true,
          description: true,
          totalAmount: true,
          lines: {
            select: { description: true, amount: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' as const },
            take: 3,
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { allocations: true } },
} satisfies Prisma.InventoryItemInclude

export type InventoryPurchaseBillRef = {
  id: string
  billNumber: string
  supplierName: string
  date: string
  description: string
  /** Finance-only — omitted when serializing for non-finance admins. */
  totalAmount?: number
  href: string | null
}

/** Serialize inventory item for admin API/UI; strip finance-only money when !isFinance. */
export function serializeInventoryItemForAdmin(
  row: {
    id: string
    productId: string | null
    variantId: string | null
    customName: string | null
    customDescription: string | null
    metalPurity: string | null
    weightGrams: { toString(): string } | number | null
    diamondCarats: { toString(): string } | number | null
    stoneCarats: { toString(): string } | number | null
    purchasePrice: { toString(): string } | number | null
    soldPrice: { toString(): string } | number | null
    potentialPrice: { toString(): string } | number | null
    qtyOnHand: number
    holderId: string
    notes: string | null
    createdAt: Date
    updatedAt: Date
    holder?: { id: string; name: string }
    product?: { id: string; name: string; itemCode: string | null } | null
    variant?: { id: string; sku: string; metalType: string; size: string | null } | null
    purchaseBills?: {
      purchaseBillId: string
      purchaseBill: {
        id: string
        billNumber: string
        supplierName: string
        date: Date
        description: string
        totalAmount: { toString(): string } | number
        lines?: { description: string; amount: { toString(): string } | number }[]
      }
    }[]
    _count?: { allocations: number }
    allocations?: unknown
    sales?: unknown
  },
  isFinance: boolean,
) {
  const bills: InventoryPurchaseBillRef[] = (row.purchaseBills ?? []).map((l) => {
    const lineSummary =
      l.purchaseBill.lines && l.purchaseBill.lines.length > 0
        ? l.purchaseBill.lines
            .map((x) => x.description.trim())
            .filter(Boolean)
            .slice(0, 3)
            .join(' · ')
        : ''
    return {
      id: l.purchaseBill.id,
      billNumber: l.purchaseBill.billNumber,
      supplierName: l.purchaseBill.supplierName,
      date: l.purchaseBill.date.toISOString(),
      description: l.purchaseBill.description.trim() || lineSummary || '',
      ...(isFinance ? { totalAmount: Number(l.purchaseBill.totalAmount) } : {}),
      href: isFinance
        ? `/admin/finance/purchase-bills?edit=${encodeURIComponent(l.purchaseBill.id)}`
        : null,
    }
  })

  return {
    id: row.id,
    productId: row.productId,
    variantId: row.variantId,
    customName: row.customName,
    customDescription: row.customDescription,
    metalPurity: row.metalPurity,
    weightGrams: row.weightGrams != null ? Number(row.weightGrams) : null,
    diamondCarats: row.diamondCarats != null ? Number(row.diamondCarats) : null,
    stoneCarats: row.stoneCarats != null ? Number(row.stoneCarats) : null,
    soldPrice: row.soldPrice != null ? Number(row.soldPrice) : null,
    ...(isFinance
      ? {
          purchasePrice: row.purchasePrice != null ? Number(row.purchasePrice) : null,
          potentialPrice: row.potentialPrice != null ? Number(row.potentialPrice) : null,
        }
      : {}),
    qtyOnHand: row.qtyOnHand,
    holderId: row.holderId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    holder: row.holder,
    product: row.product,
    variant: row.variant,
    purchaseBills: bills,
    _count: row._count,
    allocations: row.allocations,
    sales: row.sales,
  }
}
