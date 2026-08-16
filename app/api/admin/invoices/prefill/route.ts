import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPricingConfig } from '@/lib/pricing-data'
import {
  blankPayload,
  payloadFromOrder,
  totalsFromPayload,
  type PrefillOrder,
} from '@/lib/invoice-document'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  await requireAdmin()
  const orderId = req.nextUrl.searchParams.get('orderId')
  if (!orderId) {
    const payload = blankPayload()
    const totals = totalsFromPayload(payload)
    return NextResponse.json({ payload: { ...payload, lines: totals.lines }, totals })
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true, email: true } },
      payment: true,
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
                },
              },
            },
          },
        },
      },
      children: {
        include: {
          user: { select: { name: true, email: true } },
          payment: true,
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    include: {
                      stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const [goldRates, config] = await Promise.all([prisma.goldRate.findMany(), getPricingConfig()])
  const rates = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))
  const payload = payloadFromOrder(order as unknown as PrefillOrder, rates, config)
  const totals = totalsFromPayload(payload)
  return NextResponse.json({
    orderId: order.id,
    payload: { ...payload, lines: totals.lines },
    totals,
  })
}
