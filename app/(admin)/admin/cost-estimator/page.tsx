import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getPricingConfig } from '@/lib/pricing-data'
import { CostEstimator } from '@/components/admin/CostEstimator'
import type { CostEstimateSnapshot } from '@/lib/cost-estimator-history'
import {
  defaultAdditionalFromFixedCharges,
  type DiamondSetInput,
  type GoldKarat,
  type EstimatorResults,
} from '@/lib/jewellery-cost-estimator'

export const dynamic = 'force-dynamic'

/** Estimator asks for 24K ₹/g; DB stores purity rates — back-solve from 18K. Raw digits only. */
async function liveGoldRate24kRaw(): Promise<string> {
  const rate18 = await prisma.goldRate.findUnique({ where: { metalType: 'GOLD_18K' } })
  if (!rate18) return ''
  const as24k = Math.round(Number(rate18.ratePerGram) * (24 / 18))
  if (!Number.isFinite(as24k) || as24k <= 0) return ''
  return String(as24k)
}

function snapshotFromEstimate(row: {
  id: string
  name: string
  mode: string
  createdAt: Date
  payload: unknown
}): CostEstimateSnapshot | null {
  const p = row.payload as Partial<CostEstimateSnapshot> | null
  if (!p || typeof p !== 'object') return null
  if (!p.standard || !p.complex || !p.results) return null
  return {
    id: row.id,
    name: row.name,
    savedAt: row.createdAt.toISOString(),
    mode: row.mode === 'complex' ? 'complex' : 'standard',
    standard: {
      goldRate: String(p.standard.goldRate ?? ''),
      diamondRate: String(p.standard.diamondRate ?? ''),
      karat: (Number(p.standard.karat) || 18) as GoldKarat,
      weight: String(p.standard.weight ?? ''),
      carats: String(p.standard.carats ?? ''),
      wastage: String(p.standard.wastage ?? ''),
      gst: String(p.standard.gst ?? ''),
      making: String(p.standard.making ?? ''),
      additional: String(p.standard.additional ?? ''),
    },
    complex: {
      goldRate: String(p.complex.goldRate ?? ''),
      karat: (Number(p.complex.karat) || 18) as GoldKarat,
      weight: String(p.complex.weight ?? ''),
      wastage: String(p.complex.wastage ?? ''),
      gst: String(p.complex.gst ?? ''),
      making: String(p.complex.making ?? ''),
      additional: String(p.complex.additional ?? ''),
      diamondSets: (Array.isArray(p.complex.diamondSets)
        ? p.complex.diamondSets
        : []) as DiamondSetInput[],
    },
    results: p.results as EstimatorResults,
  }
}

export default async function CostEstimatorPage({
  searchParams,
}: {
  searchParams: Promise<{ quotationId?: string }>
}) {
  const { quotationId } = await searchParams
  const [initialGoldRate24k, quotation, pricing] = await Promise.all([
    liveGoldRate24kRaw(),
    quotationId
      ? prisma.quotation.findUnique({
          where: { id: quotationId },
          select: {
            id: true,
            displayId: true,
            status: true,
            estimates: { orderBy: { version: 'desc' }, take: 1 },
          },
        })
      : Promise.resolve(null),
    getPricingConfig(),
  ])

  const latest = quotation?.estimates[0] ?? null
  const initialSnapshot = latest ? snapshotFromEstimate(latest) : null
  const initialAdditional = defaultAdditionalFromFixedCharges(pricing)

  return (
    <div className="admin-page admin-page--cost-est">
      <h1 className="admin-page__title" style={{ marginBottom: 8 }}>
        Cost Estimator
      </h1>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
        Internal jewellery cost calculator (standard &amp; multi-diamond). Gold rate prefilled from
        live 18K (shown as 24K equivalent). Additional charges default to store fixed fees
        (certification + packaging + delivery).
        {quotation
          ? ' Versions save to the quotation desk; saving returns you there.'
          : ' Browser history is local unless opened from a quotation.'}
      </p>
      {quotationId && !quotation && (
        <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>
          Quotation not found.{' '}
          <Link href="/admin/quotations" style={{ color: '#032b24' }}>
            Back to list
          </Link>
        </p>
      )}
      {quotation && (
        <p style={{ fontSize: '0.8125rem', marginBottom: 16 }}>
          <Link href={`/admin/quotations/${quotation.id}`} style={{ color: '#032b24' }}>
            ← {quotation.displayId}
          </Link>
          <span style={{ color: '#6b7280' }}> · {quotation.status}</span>
          {latest ? (
            <span style={{ color: '#6b7280' }}> · prefilled from v{latest.version}</span>
          ) : null}
        </p>
      )}
      <CostEstimator
        initialGoldRate24k={initialGoldRate24k}
        initialAdditional={initialAdditional}
        quotationId={quotation?.id}
        quotationDisplayId={quotation?.displayId}
        initialSnapshot={initialSnapshot}
        initialRatesLocked={latest?.ratesLocked ?? false}
      />
    </div>
  )
}
