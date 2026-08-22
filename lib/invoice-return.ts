const INVOICE_RETURN_PREFIX = '/admin/invoices'

/** Only allow returning to invoice admin routes (blocks open redirects). */
export function parseInvoiceReturnTo(raw: string | undefined | null): string | null {
  if (!raw) return null
  if (!raw.startsWith(INVOICE_RETURN_PREFIX)) return null
  if (raw.startsWith('//') || raw.includes('://') || raw.includes('\\')) return null
  return raw
}

export function invoiceReturnWithVariant(returnTo: string, variantId: string): string {
  const url = new URL(returnTo, 'http://local.invalid')
  url.searchParams.set('addVariant', variantId)
  return `${url.pathname}${url.search}`
}
