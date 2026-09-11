import { prisma } from '@/lib/prisma'

export type InventoryOrderHit = {
  id: string
  contactName: string
  contactPhone: string
  status: string
  createdAt: string
}

/** Lightweight order search for inventory mark-as-sold picker. */
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
  }))
}
