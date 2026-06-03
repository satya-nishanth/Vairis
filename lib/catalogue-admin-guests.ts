import { prisma } from '@/lib/prisma'

export type GuestContact = {
  username: string
  email: string
  phone: string
  createdAt: Date
}

const UNKNOWN_GUEST: GuestContact = {
  username: 'unknown',
  email: '—',
  phone: '—',
  createdAt: new Date(0),
}

/** Load guest rows by id; missing ids (orphaned FKs) map to a safe placeholder. */
export async function loadGuestMap(guestUserIds: string[]) {
  const ids = [...new Set(guestUserIds)].filter(Boolean)
  if (!ids.length) return new Map<string, GuestContact>()

  const guests = await prisma.guestUser.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, email: true, phone: true, createdAt: true },
  })

  const map = new Map<string, GuestContact>()
  for (const g of guests) {
    map.set(g.id, {
      username: g.username,
      email: g.email,
      phone: g.phone,
      createdAt: g.createdAt,
    })
  }
  for (const id of ids) {
    if (!map.has(id)) map.set(id, UNKNOWN_GUEST)
  }
  return map
}

export function guestFromMap(map: Map<string, GuestContact>, guestUserId: string) {
  return map.get(guestUserId) ?? UNKNOWN_GUEST
}
