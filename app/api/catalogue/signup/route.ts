import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { username, email, phone, password } = await req.json()

  if (!username || !email || !phone || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const u = username.trim().toLowerCase()
  const e = email.trim().toLowerCase()
  const p = phone.trim().replace(/\s+/g, '')

  // check for conflicts
  const existing = await prisma.guestUser.findFirst({
    where: { OR: [{ email: e }, { username: u }, { phone: p }] },
    select: { email: true, username: true, phone: true },
  })
  if (existing) {
    if (existing.email === e) return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    if (existing.username === u) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    if (existing.phone === p) return NextResponse.json({ error: 'Phone already registered' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const guest = await prisma.guestUser.create({
    data: { username: u, email: e, phone: p, passwordHash },
  })

  const res = NextResponse.json({ guestId: guest.id, username: guest.username }, { status: 201 })
  res.cookies.set('catalogue_guest', guest.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
