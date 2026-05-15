'use client'
import { useState } from 'react'
import { calculatePrice, formatINR } from '@/lib/pricing'

type Variant = {
  id: string
  metalType: string
  weightGrams: string | number
  makingChargePerGram: string | number
  flatMakingCharge: string | number
  stoneCharges: string | number
  miscCharges: string | number
  sku: string
  size?: string | null
}

type GoldRate = {
  metalType: string
  ratePerGram: string | number
}

type Props = {
  variants: Variant[]
  goldRates: GoldRate[]
}

const METAL_LABELS: Record<string, string> = {
  GOLD_18K: '18kt Gold',
  GOLD_14K: '14kt Gold',
  ROSE_GOLD: 'Rose Gold 18kt',
}

export default function VariantSelector({ variants, goldRates }: Props) {
  const [selected, setSelected] = useState<string>(variants[0]?.id ?? '')

  const rateMap = Object.fromEntries(
    goldRates.map((r) => [r.metalType, Number(r.ratePerGram)])
  )

  const selectedVariant = variants.find((v) => v.id === selected)
  const hasPricing = variants.some(
    (v) => Number(v.makingChargePerGram) > 0 || Number(v.stoneCharges) > 0
  )

  function getPrice(v: Variant) {
    const rate = rateMap[v.metalType]
    if (!rate) return null
    return calculatePrice(v, rate)
  }

  const price = selectedVariant ? getPrice(selectedVariant) : null

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400 tracking-[0.2em] uppercase">Available In</p>

      {/* Variant buttons */}
      <div className="space-y-2">
        {variants.map((v) => {
          const isActive = v.id === selected
          const variantPrice = getPrice(v)
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelected(v.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-sm border transition-all duration-200 text-left ${
                isActive
                  ? 'border-brand-gold bg-brand-gold/5 shadow-sm'
                  : 'border-gray-100 hover:border-brand-gold/40 hover:bg-gray-50/50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Selection indicator */}
                <span
                  className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors ${
                    isActive ? 'border-brand-gold bg-brand-gold' : 'border-gray-300'
                  }`}
                />
                <div>
                  <span className={`text-sm font-medium ${isActive ? 'text-brand-dark' : 'text-gray-700'}`}>
                    {METAL_LABELS[v.metalType] ?? v.metalType}
                  </span>
                  {v.size && (
                    <span className="text-xs text-gray-400 ml-2">Size {v.size}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400">
                  {parseFloat(String(v.weightGrams)).toFixed(3)}g
                </span>
                {variantPrice && hasPricing && (
                  <p className={`text-sm font-medium mt-0.5 ${isActive ? 'text-brand-dark' : 'text-gray-600'}`}>
                    {formatINR(variantPrice.total)}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Price breakdown for selected variant */}
      {price && hasPricing && (
        <div className="bg-brand-cream rounded-sm p-4 space-y-2">
          <p className="text-xs text-gray-400 tracking-widest uppercase mb-3">Price Breakdown</p>
          {[
            { label: 'Gold Value', value: price.goldValue },
            { label: 'Making Charges', value: price.making },
            ...(price.stoneCharges > 0 ? [{ label: 'Stone Charges', value: price.stoneCharges }] : []),
            ...(price.miscCharges > 0 ? [{ label: 'Hallmark & Misc', value: price.miscCharges }] : []),
            { label: `GST (3% gold + 5% making)`, value: price.gst },
          ].map((row) => (
            <div key={row.label} className="flex justify-between text-xs">
              <span className="text-gray-500">{row.label}</span>
              <span className="text-gray-700">{formatINR(row.value)}</span>
            </div>
          ))}
          {/* Gold subtotal */}
          <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
            <span className="text-xs text-gray-500">Gold price</span>
            <span className="text-sm font-semibold text-brand-dark">{formatINR(price.total)}</span>
          </div>

          {/* Final price = gold + diamond */}
          <div className="border-t-2 border-brand-gold/40 pt-2.5 mt-1">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold text-gray-900">Final Price</span>
              <span className="text-sm font-semibold text-brand-dark">
                {formatINR(price.total)} + 💎 Diamond
              </span>
            </div>
            <p className="text-[10px] text-gray-400 text-right mt-1">
              Click enquiry button for final price
            </p>
          </div>
        </div>
      )}

      {/* No pricing set — admin hasn't filled making charges */}
      {!hasPricing && (
        <p className="text-xs text-gray-400 italic">
          Pricing details available on enquiry.
        </p>
      )}
    </div>
  )
}
