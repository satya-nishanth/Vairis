import type { InventoryItem, Prisma } from '@prisma/client'
import {
  type InventoryAuditActor,
  inventoryItemAuditSnap,
  inventoryItemHref,
  inventoryItemObjectLabel,
  logInventoryAudit,
  summarizeAllocation,
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

export const inventoryItemInclude = {
  holder: { select: { id: true, name: true } },
  product: { select: { id: true, name: true, itemCode: true } },
  variant: { select: { id: true, sku: true, metalType: true, size: true } },
  _count: { select: { allocations: true } },
} satisfies Prisma.InventoryItemInclude
