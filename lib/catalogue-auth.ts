import { cookies } from 'next/headers'
import { prisma } from './prisma'

const COOKIE = 'catalogue_guest'

export async function getGuestUser() {
  const jar = await cookies()
  const id = jar.get(COOKIE)?.value
  if (!id) return null
  try {
    return await prisma.guestUser.findUnique({ where: { id }, select: { id: true, username: true } })
  } catch (err) {
    console.error('[catalogue-auth] getGuestUser failed', err)
    return null
  }
}
