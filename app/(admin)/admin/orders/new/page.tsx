import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { isFinanceEmail } from '@/lib/finance-auth'
import { calculatePrice } from '@/lib/pricing'
import { getPricingConfig, toStoneInputs, resolvePricingConfig } from '@/lib/pricing-data'
import { ManualOrderForm } from './ManualOrderForm'

export const dynamic = 'force-dynamic'

/**
 * Manual order entry — records offline/WhatsApp sales so customers get the
 * normal order journey while self-serve checkout is behind the
 * CHECKOUT_ENABLED flag (Razorpay not fully live).
 *
 * Server side prepares the variant catalogue with a suggested price from
 * the current gold rate; the admin can override per line (negotiated deals).
 */
export default async function NewManualOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ quotationId?: string }>
}) {
  const session = await requireAdmin()
  const isFinance = isFinanceEmail(session.user.email)
  const { quotationId } = await searchParams

  const [products, goldRates, pricingConfig, quotation, holders, diamondRates] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: {
        variants: { orderBy: { metalType: 'asc' } },
        stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
    quotationId ? prisma.quotation.findUnique({ where: { id: quotationId } }) : Promise.resolve(null),
    prisma.inventoryHolder.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.diamondRate.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, ratePerCarat: true },
    }),
  ])

  const rateMap = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))

  const variantOptions = products.flatMap((p) =>
    p.variants.map((v) => {
      const rate = rateMap[v.metalType]
      const suggested = rate
        ? Math.round(
            calculatePrice(
              {
                weightGrams: v.weightGrams.toString(),
                makingChargePerGram: v.makingChargePerGram.toString(),
                flatMakingCharge: v.flatMakingCharge.toString(),
                stoneCharges: v.stoneCharges.toString(),
                miscCharges: v.miscCharges.toString(),
              },
              rate,
              { stones: toStoneInputs(p.stones), withExchange: false, config: resolvePricingConfig(pricingConfig, p) },
            ).total,
          )
        : 0
      return {
        variantId: v.id,
        productId: p.id,
        category: p.category,
        productName: p.name,
        itemCode: p.itemCode ?? '',
        sku: v.sku,
        label: `${p.name} — ${v.metalType}${v.size ? ` · ${v.size}` : ''} (${v.sku})`,
        suggestedPrice: suggested,
      }
    }),
  )

  return (
    <div className="admin-page admin-page--orders">
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        New Manual Order
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        For WhatsApp / offline sales. The customer must have an account (same email they&apos;ll
        use on the site) — the order then appears in their My Orders and on Track Order.
        Prices default to today&apos;s gold rate; override them with the negotiated amount.
      </p>
      <ManualOrderForm
        variantOptions={variantOptions}
        holders={holders}
        diamondRates={diamondRates.map((r) => ({
          id: r.id,
          label: r.label,
          ratePerCarat: Number(r.ratePerCarat),
        }))}
        quotation={quotation}
        isFinance={isFinance}
      />
    </div>
  )
}
