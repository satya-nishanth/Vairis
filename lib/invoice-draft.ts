import type { InvoicePayload } from '@/lib/invoice-document'

const KEY = 'vairis-invoice-composer-draft'

export type InvoiceComposerDraft = {
  returnPath: string
  payload: InvoicePayload
  shipSameAsBill: boolean
}

export function saveInvoiceDraft(draft: InvoiceComposerDraft) {
  sessionStorage.setItem(KEY, JSON.stringify(draft))
}

export function readInvoiceDraft(returnPath: string): InvoiceComposerDraft | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    const draft = JSON.parse(raw) as InvoiceComposerDraft
    if (draft.returnPath !== returnPath) return null
    return draft
  } catch {
    sessionStorage.removeItem(KEY)
    return null
  }
}

export function clearInvoiceDraft() {
  sessionStorage.removeItem(KEY)
}
