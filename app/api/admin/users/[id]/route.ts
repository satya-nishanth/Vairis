import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  mobile: z.string().trim().max(10).optional().nullable(),
})

/**
 * PATCH /api/admin/users/[id] — update customer name / email / mobile
 * used by manual orders and the Customers admin page.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 },
    )
  }

  const email = parsed.data.email.toLowerCase()
  const mobileRaw = (parsed.data.mobile ?? '').toString().trim()
  if (mobileRaw && !/^\d{10}$/.test(mobileRaw)) {
    return NextResponse.json({ error: 'Mobile must be 10 digits' }, { status: 400 })
  }
  const mobile = mobileRaw || null

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email,
        mobile,
      },
      select: {
        id: true,
        email: true,
        name: true,
        mobile: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    })
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      createdAt: user.createdAt.toISOString(),
      orderCount: user._count.orders,
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'A customer with this email already exists' }, { status: 409 })
    }
    throw err
  }
}
