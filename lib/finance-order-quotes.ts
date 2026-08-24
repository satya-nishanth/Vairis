import { prisma } from '@/lib/prisma'
import { calculatePrice, isOrderItemPriceSnapshot } from '@/lib/pricing'
import { getPricingConfig, toStoneInputs, type StoneWithRate } from '@/lib/pricing-data'
import { quotedAmountsFromBreakdown, roundMoney, type OrderItemQuote } from '@/lib/finance'
import type { MetalType } from '@prisma/client'

/**
 * Per-line quotes for finance sheets.
 *
 * Quoted (byKind): live catalogue pricing, except GOLD uses checkout snapshot
 * gold value when OrderItem.priceBreakdown exists.
 *
 * Selling (sellingByKind): full checkout breakdown mapped to finance kinds
 * (prefill Selling column). Falls back to quoted when no snapshot.
 */
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
          priceBreakdown: true,
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

    const live = calculatePrice(
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

    const liveByKind = quotedAmountsFromBreakdown(live, item.quantity)
    const snapshot = isOrderItemPriceSnapshot(item.priceBreakdown) ? item.priceBreakdown : null

    const byKind = { ...liveByKind }
    if (snapshot) {
      // Quoted gold from frozen checkout breakdown; everything else stays live.
      byKind.GOLD = roundMoney(snapshot.goldValue * Math.max(1, item.quantity))
    }

    const sellingByKind = snapshot
      ? quotedAmountsFromBreakdown(snapshot, item.quantity)
      : { ...liveByKind }

    const quotedTotal = Object.values(byKind).reduce((s, n) => s + n, 0)

    return {
      orderItemId: item.id,
      productName: item.productName,
      quantity: item.quantity,
      withExchange: item.withExchange,
      quotedTotal,
      snapshotTotal: Number(item.price) * item.quantity,
      byKind,
      sellingByKind,
    }
  })
}
