import type { PromoKind } from '@prisma/client'

/** Suffix for coupon lines in cart / checkout / invoices / admin. */
export function couponKindSuffix(kind: PromoKind | string | undefined | null, percent?: number | null): string {
  switch (kind) {
    case 'PERCENT':
      return percent != null ? ` · ${percent}%` : ''
    case 'FLAT':
      return ' · flat'
    case 'FREE_DELIVERY':
      return ' · free delivery'
    case 'MAKING_PERCENT':
      return percent != null ? ` · making ${percent}%` : ' · making %'
    case 'MAKING_FLAT':
      return ' · making'
    default:
      return ''
  }
}

export function promoKindListLabel(kind: PromoKind | string, value: number, maxDiscount?: number | null): string {
  switch (kind) {
    case 'PERCENT': {
      const base = `${value}%`
      return maxDiscount != null ? `${base} (max ₹${maxDiscount.toLocaleString('en-IN')})` : base
    }
    case 'FLAT':
      return `₹${value.toLocaleString('en-IN')}`
    case 'FREE_DELIVERY':
      return 'Free delivery'
    case 'MAKING_PERCENT': {
      const base = `Making ${value}%`
      return maxDiscount != null ? `${base} (max ₹${maxDiscount.toLocaleString('en-IN')})` : base
    }
    case 'MAKING_FLAT':
      return `Making ₹${value.toLocaleString('en-IN')}`
    default:
      return String(value)
  }
}
