/** sessionStorage key for cart → checkout promo handoff (tab-scoped). */
export const APPLIED_PROMO_KEY = 'vairis.appliedPromo'

export function readAppliedPromo(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = sessionStorage.getItem(APPLIED_PROMO_KEY)
    return v?.trim() ? v.trim().toUpperCase() : null
  } catch {
    return null
  }
}

export function writeAppliedPromo(code: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (code?.trim()) sessionStorage.setItem(APPLIED_PROMO_KEY, code.trim().toUpperCase())
    else sessionStorage.removeItem(APPLIED_PROMO_KEY)
  } catch {
    /* private mode / quota — ignore */
  }
}
