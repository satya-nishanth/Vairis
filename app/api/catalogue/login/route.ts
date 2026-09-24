import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'catalogue-login', 5, 60_000)
  if (limited) return limited

  const { identifier, password } = await req.json().catch(() => ({}))
  // identifier = email OR username OR phone

  if (!identifier || !password) {
    return NextResponse.json({ error: 'Identifier and password are required' }, { status: 400 })
  }

  const id = identifier.trim().toLowerCase()

  const guest = await prisma.guestUser.findFirst({
    where: { OR: [{ email: id }, { username: id }, { phone: id }] },
  })

  if (!guest) {
    return NextResponse.json({ error: 'No account found. Please sign up first.' }, { status: 404 })
  }

  const valid = await bcrypt.compare(password, guest.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const res = NextResponse.json({ guestId: guest.id, username: guest.username })
  res.cookies.set('catalogue_guest', guest.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
