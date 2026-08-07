import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { promoSchema } from '@/lib/promo'

export const dynamic = 'force-dynamic'

export async function GET() {
  await requireAdmin()
  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { redemptions: true } } },
  })
  return NextResponse.json(
    promos.map((p) => ({
      ...p,
      value: Number(p.value),
      minOrderValue: Number(p.minOrderValue),
      maxDiscount: p.maxDiscount != null ? Number(p.maxDiscount) : null,
      redemptionCount: p._count.redemptions,
    })),
  )
}

export async function POST(req: NextRequest) {
  await requireAdmin()
  const parsed = promoSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid promo' },
      { status: 400 },
    )
  }
  const d = parsed.data
  if (d.kind === 'PERCENT' && d.value > 100) {
    return NextResponse.json({ error: 'Percent discount cannot exceed 100' }, { status: 400 })
  }
  try {
    const promo = await prisma.promoCode.create({
      data: {
        code: d.code,
        description: d.description || null,
        kind: d.kind,
        value: d.value,
        minOrderValue: d.minOrderValue,
        maxDiscount: d.maxDiscount,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        maxRedemptions: d.maxRedemptions,
        maxPerUser: d.maxPerUser,
        active: d.active,
      },
    })
    return NextResponse.json(promo, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'A promo with this code already exists' }, { status: 409 })
  }
}
