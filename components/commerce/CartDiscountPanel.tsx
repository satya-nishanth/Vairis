'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PromoKind } from '@prisma/client'
import { formatPrice } from '@/lib/ui-data'
import { couponKindSuffix } from '@/lib/promo-labels'

export type DiscountLeg = {
  id: string
  name?: string
  code?: string
  kind?: PromoKind
  amount: number
  percent?: number
}

type PreviewResponse = {
  goodsTotal: number
  discountAmount: number
  payable: number
  automatic: DiscountLeg | null
  coupon: DiscountLeg | null
  error?: string
}

type Props = {
  /** When cart lines change, bump this to refetch (e.g. item count / subtotal). */
  refreshKey: string | number
  promoCode?: string | null
  onPreview?: (preview: PreviewResponse | null) => void
}

export function useDiscountPreview(refreshKey: string | number, promoCode?: string | null) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/discounts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: promoCode || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not load discounts')
        setPreview(null)
        return null
      }
      setPreview(data)
      return data as PreviewResponse
    } catch {
      setError('Could not load discounts')
      setPreview(null)
      return null
    } finally {
      setBusy(false)
    }
  }, [promoCode, refreshKey])

  useEffect(() => {
    void load()
  }, [load])

  return { preview, error, busy, reload: load }
}

/** Summary rows for automatic discount + coupon (never merged). */
export function discountSummaryLines(
  automatic: DiscountLeg | null | undefined,
  coupon: DiscountLeg | null | undefined,
): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = []
  if (automatic && automatic.amount > 0) {
    const pct =
      automatic.percent != null ? ` · ${automatic.percent}%` : ''
    const name = automatic.name ? ` (${automatic.name}${pct})` : pct ? ` (${pct.replace(' · ', '')})` : ''
    lines.push({
      label: `Discount${name}`,
      value: `− ${formatPrice(automatic.amount)}`,
    })
  }
  if (coupon && coupon.amount > 0) {
    const code = coupon.code ?? 'Coupon'
    const detail = couponKindSuffix(coupon.kind, coupon.percent)
    lines.push({
      label: `Coupon (${code}${detail})`,
      value: `− ${formatPrice(coupon.amount)}`,
    })
  }
  return lines
}

export function CartDiscountPanel({ refreshKey, promoCode, onPreview }: Props) {
  const { preview, error } = useDiscountPreview(refreshKey, promoCode)
  useEffect(() => {
    onPreview?.(preview)
  }, [preview, onPreview])

  if (error && !preview) {
    return (
      <p style={{ fontSize: '0.75rem', color: '#b91c1c', margin: '8px 0 0' }} role="status">
        {error}
      </p>
    )
  }
  return null
}
