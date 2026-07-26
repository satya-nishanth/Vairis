import { NextRequest, NextResponse } from 'next/server'
import { getAppUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculatePrice } from '@/lib/pricing'
import { getPricingConfig, toStoneInputs } from '@/lib/pricing-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [items, goldRates, pricingConfig] = await Promise.all([
    prisma.cartItem.findMany({
      where: { userId: user.id },
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
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
  ])
  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))
  const withPrice = items.map((item) => ({
    ...item,
    unitPrice: Math.round(
      calculatePrice(
        {
          weightGrams: item.variant.weightGrams.toString(),
          makingChargePerGram: item.variant.makingChargePerGram.toString(),
          flatMakingCharge: item.variant.flatMakingCharge.toString(),
          stoneCharges: item.variant.stoneCharges.toString(),
          miscCharges: item.variant.miscCharges.toString(),
        },
        rateMap[item.variant.metalType] ?? 0,
        {
          stones: toStoneInputs(item.variant.product.stones),
          withExchange: item.withExchange,
          config: pricingConfig,
        },
      ).total,
    ),
  }))
  return NextResponse.json(withPrice)
}

export async function POST(req: NextRequest) {
  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { variantId, quantity, withExchange = false } = await req.json()

  const item = await prisma.cartItem.upsert({
    where: {
      userId_variantId_withExchange: {
        userId: user.id,
        variantId,
        withExchange: Boolean(withExchange),
      },
    },
    update: { quantity: { increment: quantity } },
    create: { userId: user.id, variantId, quantity, withExchange: Boolean(withExchange) },
  })
  return NextResponse.json(item, { status: 201 })
}
