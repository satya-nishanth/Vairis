import { prisma } from '@/lib/prisma'

export type InventoryOrderHit = {
  id: string
  contactName: string
  contactPhone: string
  status: string
  createdAt: string
  grandTotal: number
  itemsLabel: string
}

function itemsLabel(
  items: { productName: string; quantity: number }[],
  itemCount: number,
): string {
  if (items.length === 0) return '—'
  if (items.length === 1) {
    const i = items[0]
    return i.quantity > 1 ? `${i.productName} ×${i.quantity}` : i.productName
  }
  const first = items[0].productName
  const more = Math.max(0, itemCount - 1)
  return more > 0 ? `${first} +${more} more` : first
}

/** Order search for inventory mark-as-sold picker. */
export async function searchInventoryOrders(q: string): Promise<InventoryOrderHit[]> {
  const needle = q.trim()
  if (needle.length < 2) return []

  const rows = await prisma.order.findMany({
    where: {
      OR: [
        { contactName: { contains: needle, mode: 'insensitive' } },
        { contactPhone: { contains: needle } },
        { id: { contains: needle, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      contactName: true,
      contactPhone: true,
      status: true,
      createdAt: true,
      grandTotal: true,
      items: { select: { productName: true, quantity: true }, take: 4 },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return rows.map((r) => ({
    id: r.id,
    contactName: r.contactName,
    contactPhone: r.contactPhone,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    grandTotal: Number(r.grandTotal),
    itemsLabel: itemsLabel(r.items, r._count.items),
  }))
}
