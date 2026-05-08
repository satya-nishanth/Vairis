export interface PriceBreakdown {
  goldValue: number
  making: number
  stoneCharges: number
  miscCharges: number
  gst: number
  total: number
}

export function calculatePrice(
  variant: {
    weightGrams: number | string
    makingChargePerGram: number | string
    flatMakingCharge: number | string
    stoneCharges: number | string
    miscCharges: number | string
  },
  goldRatePerGram: number
): PriceBreakdown {
  const weight = Number(variant.weightGrams)
  const goldValue = weight * goldRatePerGram
  const making = weight * Number(variant.makingChargePerGram) + Number(variant.flatMakingCharge)
  const stones = Number(variant.stoneCharges)
  const misc = Number(variant.miscCharges)
  const gst = goldValue * 0.03 + making * 0.05
  return {
    goldValue,
    making,
    stoneCharges: stones,
    miscCharges: misc,
    gst,
    total: goldValue + making + stones + misc + gst,
  }
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}
