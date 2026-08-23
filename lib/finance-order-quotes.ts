import { prisma } from '@/lib/prisma'
import { calculatePrice } from '@/lib/pricing'
import { getPricingConfig, toStoneInputs, type StoneWithRate } from '@/lib/pricing-data'
import { quotedAmountsFromBreakdown, type OrderItemQuote } from '@/lib/finance'
import type { MetalType } from '@prisma/client'

/** Live catalogue quotes for each line item on an order (finance sheet guidance). */
export async function getOrderItemQuotes(orderId: string): Promise<OrderItemQuote[]> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      items: {
        select: {
          id: true,
          productName: true,
          quantity: true,
          price: true,
          withExchange: true,
          variant: {
            select: {
              weightGrams: true,
              makingChargePerGram: true,
              flatMakingCharge: true,
              stoneCharges: true,
              miscCharges: true,
              metalType: true,
              product: {
                select: {
                  caratWeight: true,
                  stones: {
                    include: { diamondRate: true },
                    orderBy: { sortOrder: 'asc' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!order) return []

  const [config, goldRates, fallbackDiamond] = await Promise.all([
    getPricingConfig(),
    prisma.goldRate.findMany(),
    prisma.diamondRate.findFirst({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])
  const rateMap = Object.fromEntries(goldRates.map((g) => [g.metalType, Number(g.ratePerGram)])) as Record<
    MetalType,
    number
  >

  return order.items.map((item) => {
    const v = item.variant
    const productStones = (v.product.stones ?? []) as StoneWithRate[]
    let stones = toStoneInputs(productStones)

    if (stones.length === 0 && Number(v.product.caratWeight) > 0 && fallbackDiamond) {
      stones = [
        {
          caratWeight: Number(v.product.caratWeight),
          ratePerCarat: Number(fallbackDiamond.ratePerCarat),
          ratePerCaratExchange: Number(fallbackDiamond.ratePerCaratExchange),
          typeLabel: fallbackDiamond.label,
        },
      ]
    }

    const breakdown = calculatePrice(
      {
        weightGrams: Number(v.weightGrams),
        makingChargePerGram: Number(v.makingChargePerGram),
        flatMakingCharge: Number(v.flatMakingCharge),
        stoneCharges: Number(v.stoneCharges),
        miscCharges: Number(v.miscCharges),
      },
      rateMap[v.metalType] ?? 0,
      {
        stones,
        withExchange: item.withExchange,
        config,
      },
    )

    const byKind = quotedAmountsFromBreakdown(breakdown, item.quantity)
    const quotedTotal = Object.values(byKind).reduce((s, n) => s + n, 0)

    return {
      orderItemId: item.id,
      productName: item.productName,
      quantity: item.quantity,
      withExchange: item.withExchange,
      quotedTotal,
      snapshotTotal: Number(item.price) * item.quantity,
      byKind,
    }
  })
}
