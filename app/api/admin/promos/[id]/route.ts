import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { promoSchema } from '@/lib/promo'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params

  const parsed = promoSchema.partial().safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid promo' },
      { status: 400 },
    )
  }
  const d = parsed.data
  if (d.kind === 'PERCENT' && d.value !== undefined && d.value > 100) {
    return NextResponse.json({ error: 'Percent discount cannot exceed 100' }, { status: 400 })
  }

  try {
    const promo = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(d.code !== undefined && { code: d.code }),
        ...(d.description !== undefined && { description: d.description || null }),
        ...(d.kind !== undefined && { kind: d.kind }),
        ...(d.value !== undefined && { value: d.value }),
        ...(d.minOrderValue !== undefined && { minOrderValue: d.minOrderValue }),
        ...(d.maxDiscount !== undefined && { maxDiscount: d.maxDiscount }),
        ...(d.startsAt !== undefined && { startsAt: d.startsAt ? new Date(d.startsAt) : null }),
        ...(d.endsAt !== undefined && { endsAt: d.endsAt ? new Date(d.endsAt) : null }),
        ...(d.maxRedemptions !== undefined && { maxRedemptions: d.maxRedemptions }),
        ...(d.maxPerUser !== undefined && { maxPerUser: d.maxPerUser }),
        ...(d.active !== undefined && { active: d.active }),
      },
    })
    return NextResponse.json(promo)
  } catch {
    return NextResponse.json({ error: 'Update failed (missing promo or duplicate code)' }, { status: 409 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params
  const redemptions = await prisma.promoRedemption.count({ where: { promoCodeId: id } })
  if (redemptions > 0) {
    // Keep history intact — deactivate instead of delete.
    await prisma.promoCode.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ deactivated: true })
  }
  await prisma.promoCode.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
