import { calculatePrice, DEFAULT_PRICING_CONFIG, type PricingConfig } from '@/lib/pricing'
import { amountInWords, splitInvoiceTax } from '@/lib/invoice-tax'
import { toStoneInputs, type StoneWithRate } from '@/lib/pricing-data'
import type { InvoiceStatus } from '@prisma/client'

export type InvoiceParty = {
  name: string
  lines: string
  phone: string
}

export type InvoiceStoneRow = {
  label: string
  caratWeight: number
  ratePerCarat: number
  value: number
  exchange: boolean
}

export type InvoiceLine = {
  productName: string
  itemCode: string
  sku: string
  metalLabel: string
  huid: string
  certs: string
  withExchange: boolean
  quantity: number
  weightGrams: number
  goldRatePerGram: number
  goldValue: number
  wastagePct: number
  wastage: number
  makingPerGram: number
  flatMaking: number
  making: number
  stones: InvoiceStoneRow[]
  stoneValue: number
  leadIncentive: number
  miscCharges: number
  itemValue: number
  makingPlusWastage: number
  taxable: number
}

export type InvoicePayload = {
  seller: {
    name: string
    address: string
    gstin: string
    email: string
    phone: string
  }
  billedTo: InvoiceParty
  shippedTo: InvoiceParty
  payment: {
    method: string
    reference: string
    received: string
    status: string
  }
  invoiceDate: string
  placeOfSupply: string
  notes: {
    exchange: string
    certification: string
    returns: string
  }
  lines: InvoiceLine[]
}

export const DEFAULT_INVOICE_NOTES = {
  exchange:
    'Pieces marked Exchange opted are billed at the buy-back linked diamond rate and stay eligible for lifetime exchange against their diamond value. Pieces marked No exchange are billed at the standard diamond rate. Wastage is charged on gold weight at the rate shown per item.',
  certification:
    'Every piece is BIS hallmarked with a unique HUID and ships with its IGI or SGL diamond grading report, quoted per item above. Certificates are enclosed with the parcel and mirrored in your account at thevairis.com.',
  returns:
    'Unworn pieces may be returned within 15 days of delivery in their original packaging with all certificates for a full refund. Lifetime exchange is offered at prevailing metal and diamond rates, less making charges. Engraved and made-to-order pieces are final sale. Write to care@thevairis.com to raise a request.',
}

export function sellerDefaults() {
  return {
    name: process.env.INVOICE_SELLER_NAME || 'Vairis Jewels Private Limited',
    address: process.env.INVOICE_SELLER_ADDRESS || '301, Panchratna Complex, Opera House, Mumbai 400004',
    gstin: process.env.INVOICE_SELLER_GSTIN || '27AABCV1234K1ZP',
    email: process.env.INVOICE_SELLER_EMAIL || 'care@thevairis.com',
    phone: process.env.INVOICE_SELLER_PHONE || '+91 98200 00000',
  }
}

export function metalLabel(metalType: string): string {
  if (metalType === 'GOLD_14K') return '14K Yellow Gold'
  if (metalType === 'ROSE_GOLD') return '18K Rose Gold'
  return '18K Yellow Gold'
}

export function goldRateKey(metalType: string): 'GOLD_14K' | 'GOLD_18K' {
  return metalType === 'GOLD_14K' ? 'GOLD_14K' : 'GOLD_18K'
}

export function recomputeLine(line: InvoiceLine, configLabel: string): InvoiceLine {
  const qty = Math.max(1, Number(line.quantity) || 1)
  const unit = calculatePrice(
    {
      weightGrams: line.weightGrams,
      makingChargePerGram: line.makingPerGram,
      flatMakingCharge: line.flatMaking,
      stoneCharges: 0,
      miscCharges: line.miscCharges,
    },
    Number(line.goldRatePerGram) || 0,
    {
      withExchange: line.withExchange,
      leadIncentive: Number(line.leadIncentive) || 0,
      config: {
        vaGoldPct: Number(line.wastagePct) || 0,
        vaStonePct: 0,
        vaLabel: configLabel,
      },
      stones: line.stones.map((s) => ({
        typeLabel: s.label,
        caratWeight: s.caratWeight,
        ratePerCarat: s.ratePerCarat,
        ratePerCaratExchange: s.ratePerCarat,
      })),
    },
  )
  const stones = line.stones.map((s) => ({
    ...s,
    value: Number(s.caratWeight) * Number(s.ratePerCarat),
    exchange: line.withExchange,
  }))
  return {
    ...line,
    quantity: qty,
    goldValue: unit.goldValue,
    wastage: unit.goldVA,
    making: unit.making,
    stoneValue: unit.stoneValue,
    stones,
    itemValue: unit.goldValue + unit.stoneValue,
    makingPlusWastage: unit.making + unit.goldVA,
    taxable: unit.taxable * qty,
  }
}

export function totalsFromPayload(payload: InvoicePayload) {
  const lines = payload.lines.map((l) => recomputeLine(l, 'Wastage'))
  const taxable = lines.reduce((s, l) => s + l.taxable, 0)
  const tax = splitInvoiceTax(taxable, payload.placeOfSupply)
  return {
    lines,
    ...tax,
    amountInWords: amountInWords(tax.grandTotal),
  }
}

export function blankPayload(): InvoicePayload {
  return {
    seller: sellerDefaults(),
    billedTo: { name: '', lines: '', phone: '' },
    shippedTo: { name: '', lines: '', phone: '' },
    payment: { method: '', reference: '', received: '', status: 'Unpaid' },
    invoiceDate: new Date().toISOString().slice(0, 10),
    placeOfSupply: 'Maharashtra (27)',
    notes: { ...DEFAULT_INVOICE_NOTES },
    lines: [blankLine()],
  }
}

export function blankLine(): InvoiceLine {
  return {
    productName: '',
    itemCode: '',
    sku: '',
    metalLabel: '18K Yellow Gold',
    huid: '',
    certs: '',
    withExchange: false,
    quantity: 1,
    weightGrams: 0,
    goldRatePerGram: 0,
    goldValue: 0,
    wastagePct: DEFAULT_PRICING_CONFIG.vaGoldPct,
    wastage: 0,
    makingPerGram: 0,
    flatMaking: 0,
    making: 0,
    stones: [],
    stoneValue: 0,
    leadIncentive: 0,
    miscCharges: 0,
    itemValue: 0,
    makingPlusWastage: 0,
    taxable: 0,
  }
}

export type PrefillOrder = {
  id: string
  status: string
  createdAt: Date
  contactName: string
  contactPhone: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  pincode: string
  user: { name: string; email: string }
  payment: { razorpayPaymentId: string | null; razorpayOrderId: string; status: string; createdAt: Date } | null
  items: Array<{
    productName: string
    quantity: number
    withExchange: boolean
    variant: {
      sku: string
      metalType: string
      weightGrams: { toString(): string } | number
      makingChargePerGram: { toString(): string } | number
      flatMakingCharge: { toString(): string } | number
      miscCharges: { toString(): string } | number
      product: {
        itemCode: string | null
        stones: StoneWithRate[]
      }
    }
  }>
  children?: PrefillOrder[]
}

function addressBlock(o: PrefillOrder): string {
  return [
    o.addressLine1,
    o.addressLine2,
    `${o.city} ${o.pincode}`.trim(),
    `${o.state}, India`,
  ]
    .filter(Boolean)
    .join('\n')
}

function flattenItems(order: PrefillOrder): PrefillOrder['items'] {
  if (order.children && order.children.length > 0) {
    return order.children.flatMap((c) => flattenItems(c))
  }
  return order.items
}

export function payloadFromOrder(
  order: PrefillOrder,
  rates: Record<string, number>,
  config: PricingConfig,
): InvoicePayload {
  const paid =
    order.payment?.status === 'CAPTURED' ||
    ['PAYMENT_CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status)
  const party: InvoiceParty = {
    name: order.contactName || order.user.name,
    lines: addressBlock(order),
    phone: order.contactPhone ? `+91 ${order.contactPhone}` : '',
  }
  const lines = flattenItems(order).map((item) => {
    const metal = item.variant.metalType
    const goldRate = rates[goldRateKey(metal)] ?? rates[metal] ?? 0
    const stones = toStoneInputs(item.variant.product.stones)
    const line = recomputeLine(
      {
        ...blankLine(),
        productName: item.productName,
        itemCode: item.variant.product.itemCode ?? '',
        sku: item.variant.sku,
        metalLabel: metalLabel(metal),
        withExchange: item.withExchange,
        quantity: item.quantity,
        weightGrams: Number(item.variant.weightGrams),
        goldRatePerGram: goldRate,
        wastagePct: Number(config.vaGoldPct),
        makingPerGram: Number(item.variant.makingChargePerGram),
        flatMaking: Number(item.variant.flatMakingCharge),
        miscCharges: Number(item.variant.miscCharges),
        stones: stones.map((s) => {
          const rate = Number(item.withExchange ? s.ratePerCaratExchange : s.ratePerCarat)
          const carat = Number(s.caratWeight)
          return {
            label: s.typeLabel ?? 'Diamond',
            caratWeight: carat,
            ratePerCarat: rate,
            value: carat * rate,
            exchange: item.withExchange,
          }
        }),
      },
      config.vaLabel,
    )
    return line
  })

  return {
    seller: sellerDefaults(),
    billedTo: party,
    shippedTo: { ...party },
    payment: {
      method: order.payment ? 'Online' : '',
      reference: order.payment?.razorpayPaymentId || order.payment?.razorpayOrderId || '',
      received: order.payment ? order.payment.createdAt.toISOString().slice(0, 10) : '',
      status: paid ? 'Paid in full' : 'Unpaid',
    },
    invoiceDate: new Date().toISOString().slice(0, 10),
    placeOfSupply: /maharashtra/i.test(order.state) ? 'Maharashtra (27)' : order.state || 'Maharashtra (27)',
    notes: { ...DEFAULT_INVOICE_NOTES },
    lines: lines.length > 0 ? lines : [blankLine()],
  }
}

export function invoiceStatusFromPayload(payload: InvoicePayload): InvoiceStatus {
  return /paid/i.test(payload.payment.status) ? 'PAID' : 'UNPAID'
}
