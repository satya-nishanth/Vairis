import { GST_RATE } from '@/lib/pricing'

export const MAHARASHTRA_GSTIN_PREFIX = '27'

export function isMaharashtra(place: string): boolean {
  const s = place.trim()
  if (!s) return true
  return /maharashtra/i.test(s) || /^27\b/.test(s)
}

export function gstinStateCode(place: string): string {
  return isMaharashtra(place) ? MAHARASHTRA_GSTIN_PREFIX : ''
}

export type InvoiceTaxSplit = {
  taxable: number
  gstAmount: number
  cgst: number
  sgst: number
  igst: number
  intraState: boolean
  roundOff: number
  grandTotal: number
}

/** Split 3% GST into CGST/SGST (Maharashtra) or IGST (other states), then round payable to a rupee. */
export function splitInvoiceTax(taxable: number, placeOfSupply: string): InvoiceTaxSplit {
  const gstAmount = taxable * GST_RATE
  const intraState = isMaharashtra(placeOfSupply)
  const cgst = intraState ? gstAmount / 2 : 0
  const sgst = intraState ? gstAmount / 2 : 0
  const igst = intraState ? 0 : gstAmount
  const raw = taxable + gstAmount
  const grandTotal = Math.round(raw)
  const roundOff = grandTotal - raw
  return { taxable, gstAmount, cgst, sgst, igst, intraState, roundOff, grandTotal }
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function chunkToWords(n: number): string {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` and ${chunkToWords(n % 100)}` : ''}`
}

/** Indian numbering: crore / lakh / thousand. Integer rupees only. */
export function amountInWords(rupees: number): string {
  const n = Math.round(Math.abs(rupees))
  if (n === 0) return 'Rupees Zero Only'
  const crore = Math.floor(n / 1_00_00_000)
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000)
  const thousand = Math.floor((n % 1_00_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (crore) parts.push(`${chunkToWords(crore)} Crore`)
  if (lakh) parts.push(`${chunkToWords(lakh)} Lakh`)
  if (thousand) parts.push(`${chunkToWords(thousand)} Thousand`)
  if (rest) parts.push(chunkToWords(rest))
  return `Rupees ${parts.join(' ')} Only`
}

export function formatINRGrouped(amount: number, fractionDigits = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount)
}
