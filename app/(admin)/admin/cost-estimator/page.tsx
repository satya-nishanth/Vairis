import { prisma } from '@/lib/prisma'
import { CostEstimator } from '@/components/admin/CostEstimator'

export const dynamic = 'force-dynamic'

/** Estimator asks for 24K ₹/g; DB stores purity rates — back-solve from 18K. Raw digits only. */
async function liveGoldRate24kRaw(): Promise<string> {
  const rate18 = await prisma.goldRate.findUnique({ where: { metalType: 'GOLD_18K' } })
  if (!rate18) return ''
  const as24k = Math.round(Number(rate18.ratePerGram) * (24 / 18))
  if (!Number.isFinite(as24k) || as24k <= 0) return ''
  return String(as24k)
}

export default async function CostEstimatorPage() {
  const initialGoldRate24k = await liveGoldRate24kRaw()

  return (
    <div className="admin-page admin-page--cost-est">
      <h1 className="admin-page__title" style={{ marginBottom: 8 }}>
        Cost Estimator
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
        Internal jewellery cost calculator (standard &amp; multi-diamond). Gold rate prefilled from
        live 18K (shown as 24K equivalent). History is saved in this browser.
      </p>
      <CostEstimator initialGoldRate24k={initialGoldRate24k} />
    </div>
  )
}
