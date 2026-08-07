import { cookies } from 'next/headers'
import { prisma } from './prisma'

const COOKIE = 'catalogue_guest'

export async function getGuestUser() {
  const jar = await cookies()
  const id = jar.get(COOKIE)?.value
  if (!id) return null
  return prisma.guestUser.findUnique({ where: { id } })
}

export function setGuestCookie(res: Response, guestId: string) {
  res.headers.append(
    'Set-Cookie',
    `${COOKIE}=${guestId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
  )
}
