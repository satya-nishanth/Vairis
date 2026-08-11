import { prisma } from '@/lib/prisma'
import { AdminGuide } from '@/components/admin/AdminGuide'
import { PricingSettingsForm } from './PricingSettingsForm'

export const dynamic = 'force-dynamic'

/**
 * Pricing settings — Value Addition percentages (disclosed line on every
 * price breakup) and per-carat diamond rates (with / without exchange).
 */
export default async function PricingSettingsPage() {
  const [settings, diamondRates] = await Promise.all([
    prisma.pricingSettings.findUnique({ where: { id: 1 } }),
    prisma.diamondRate.findMany({ orderBy: { sortOrder: 'asc' } }),
  ])

  return (
    <div className="admin-page" style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 400, color: '#111827', marginBottom: '0.5rem' }}>
        Pricing Settings
      </h1>
      <AdminGuide
        pageKey="pricing"
        title="Pricing"
        blurb="Gold rate, Value-Addition %, making charges, diamond rates — feeds the live pricing formula."
        tips={[
          'Changes apply to new price calculations only — existing orders keep their locked-in price.',
          'Diamond rates are per carat; customers choose with-exchange or without-exchange pricing on the product page.',
        ]}
      />
      <PricingSettingsForm
        initial={{
          vaGoldPct: Number(settings?.vaGoldPct ?? 5),
          vaStonePct: Number(settings?.vaStonePct ?? 5),
          vaLabel: settings?.vaLabel ?? 'Value Addition',
          showPricesGlobal: settings?.showPricesGlobal ?? true,
          diamondRates: diamondRates.map((r) => ({
            id: r.id,
            code: r.code,
            label: r.label,
            ratePerCarat: Number(r.ratePerCarat),
            ratePerCaratExchange: Number(r.ratePerCaratExchange),
            active: r.active,
          })),
        }}
      />
    </div>
  )
}
