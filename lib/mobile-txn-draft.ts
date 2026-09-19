/** Client-side draft between /m/finance/txn → allocate (sessionStorage + in-memory). */

export const MOBILE_TXN_DRAFT_KEY = 'vairis.mobileTxnDraft.v1'
/** HttpOnly cookie used by server action between page 1 → page 2. */
export const MOBILE_TXN_COOKIE = 'vairis_mobile_txn_draft_v1'

export type MobileTxnDraft = {
  date: string
  direction: 'INFLOW' | 'OUTFLOW' | 'TRANSFER'
  amount: string
  /** Vault legs use grams; otherwise INR. */
  amountUnit: 'INR' | 'GRAMS'
  description: string
  accountId: string
  paidThroughAccountId: string
  transferToAccountId: string
  categoryId: string
  contactId: string | null
  contactText: string
  /** Display labels for the allocate summary chip */
  accountName: string
  paidThroughName: string
  transferToName: string
  categoryName: string
}

/** Same-tab fallback when sessionStorage is unavailable or slow across soft nav. */
let memoryDraft: MobileTxnDraft | null = null

function normalize(d: MobileTxnDraft): MobileTxnDraft | null {
  if (!d?.date || !d?.direction || !d?.amount || !d?.accountId || !d?.paidThroughAccountId) {
    return null
  }
  if (d.amountUnit !== 'GRAMS' && d.amountUnit !== 'INR') {
    d.amountUnit = 'INR'
  }
  return d
}

export function readMobileTxnDraft(): MobileTxnDraft | null {
  if (memoryDraft) {
    const ok = normalize(memoryDraft)
    if (ok) return ok
  }
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(MOBILE_TXN_DRAFT_KEY)
    if (!raw) return null
    const d = normalize(JSON.parse(raw) as MobileTxnDraft)
    if (d) memoryDraft = d
    return d
  } catch {
    return null
  }
}

export function writeMobileTxnDraft(draft: MobileTxnDraft) {
  memoryDraft = draft
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(MOBILE_TXN_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* memoryDraft still available for same-tab nav */
  }
}

export function clearMobileTxnDraft() {
  memoryDraft = null
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(MOBILE_TXN_DRAFT_KEY)
  } catch {
    /* ignore */
  }
}
