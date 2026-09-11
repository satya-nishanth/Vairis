import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users?q=… — customer lookup for manual order creation
 * (WhatsApp sales). Matches email or name, case-insensitive, max 10.
 * The customer must already have an account — that's what lets them see
 * the order under My Orders and use /track-order.
 */
export async function GET(req: NextRequest) {
  await requireAdmin()

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, email: true, name: true, mobile: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(users)
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  mobile: z.string().trim().max(10).optional(),
})

/**
 * POST /api/admin/users — create a customer contact for manual orders.
 * Creates the Prisma User row (site login can link later via same email).
 */
export async function POST(req: NextRequest) {
  await requireAdmin()
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 },
    )
  }

  const email = parsed.data.email.toLowerCase()
  const mobileRaw = parsed.data.mobile?.trim() || ''
  if (mobileRaw && !/^\d{10}$/.test(mobileRaw)) {
    return NextResponse.json({ error: 'Mobile must be 10 digits' }, { status: 400 })
  }
  const mobile = mobileRaw || null

  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        mobile,
      },
      select: { id: true, email: true, name: true, mobile: true },
    })
    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, mobile: true },
      })
      if (existing) {
        return NextResponse.json(
          { error: 'A customer with this email already exists', user: existing },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    throw err
  }
}
