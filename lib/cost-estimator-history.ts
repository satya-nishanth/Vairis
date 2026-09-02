import type { DiamondSetInput, GoldKarat, EstimatorResults } from '@/lib/jewellery-cost-estimator'

export const COST_EST_HISTORY_KEY = 'vairis.costEstimator.history.v1'

export type CostEstimateSnapshot = {
  id: string
  name: string
  savedAt: string
  mode: 'standard' | 'complex'
  standard: {
    goldRate: string
    diamondRate: string
    karat: GoldKarat
    weight: string
    carats: string
    wastage: string
    gst: string
    making: string
    additional: string
  }
  complex: {
    goldRate: string
    karat: GoldKarat
    weight: string
    wastage: string
    gst: string
    making: string
    additional: string
    diamondSets: DiamondSetInput[]
  }
  results: EstimatorResults
}

export function loadCostEstimateHistory(): CostEstimateSnapshot[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(COST_EST_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CostEstimateSnapshot[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCostEstimateHistory(items: CostEstimateSnapshot[]) {
  window.localStorage.setItem(COST_EST_HISTORY_KEY, JSON.stringify(items.slice(0, 50)))
}

export function upsertCostEstimate(item: CostEstimateSnapshot): CostEstimateSnapshot[] {
  const prev = loadCostEstimateHistory().filter((x) => x.id !== item.id)
  const next = [item, ...prev]
  saveCostEstimateHistory(next)
  return next
}

export function deleteCostEstimate(id: string): CostEstimateSnapshot[] {
  const next = loadCostEstimateHistory().filter((x) => x.id !== id)
  saveCostEstimateHistory(next)
  return next
}
