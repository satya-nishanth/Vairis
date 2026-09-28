import {
  calculatePrice,
  DEFAULT_PRICING_CONFIG,
  isOrderItemPriceSnapshot,
  splitGemValues,
  type OrderItemPriceSnapshot,
  type PricingConfig,
  type StoneInput,
} from '@/lib/pricing'
import { amountInWords, normalizeInvoiceGstScheme, splitInvoiceTax, type InvoiceGstScheme } from '@/lib/invoice-tax'
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
  /** Active ₹/ct shown on the invoice (std or exch depending on line.withExchange). */
  ratePerCarat: number
  /** Standard (without-exchange) ₹/ct — kept so toggling Exchange on a locked line can swap display. */
  ratePerCaratStd?: number
  /** With-exchange ₹/ct. */
  ratePerCaratExchange?: number
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
  /** Total gem cost (diamonds + other stones). Used for taxable. */
  stoneValue: number
  /** Diamond portion of stoneValue (matches order selling / finance split). */
  diamondValue: number
  /** Non-diamond / coloured-stone portion of stoneValue. */
  otherStoneValue: number
  leadIncentive: number
  miscCharges: number
  /** Legacy flat stone cost when the product has no stone rows. */
  legacyStoneCharges: number
  itemValue: number
  makingPlusWastage: number
  taxable: number
  /**
   * When true, amounts came from OrderItem.priceBreakdown and must not be
   * recomputed from live catalogue rates until the admin edits pricing fields.
   */
  lockedPricing?: boolean
}

/** Product / cart / order-item input for `invoiceFromProducts`. */
export type InvoiceProductInput = {
  productName: string
  itemCode?: string
  sku?: string
  metalType: string
  quantity?: number
  withExchange?: boolean
  weightGrams: number | string
  makingChargePerGram: number | string
  flatMakingCharge?: number | string
  miscCharges?: number | string
  stoneCharges?: number | string
  stones?: StoneInput[]
  leadIncentive?: number
  goldRatePerGram?: number
  huid?: string
  certs?: string
}

/** Catalogue row for the invoice product picker (serialisable to the client). */
export type InvoiceCatalogueStone = {
  typeLabel: string
  caratWeight: number
  ratePerCarat: number
  ratePerCaratExchange: number
}

export type InvoiceCatalogueVariant = {
  variantId: string
  productId: string
  category: string
  productName: string
  itemCode: string
  sku: string
  metalType: string
  size: string
  label: string
  weightGrams: number
  makingChargePerGram: number
  flatMakingCharge: number
  miscCharges: number
  stoneCharges: number
  stones: InvoiceCatalogueStone[]
}

export type InvoiceDiamondRateOption = {
  id: string
  label: string
  ratePerCarat: number
  ratePerCaratExchange: number
}

export type InvoiceFromProductsContext = {
  billedTo?: InvoiceParty
  shippedTo?: InvoiceParty
  placeOfSupply?: string
  payment?: Partial<InvoicePayload['payment']>
  invoiceDate?: string
  notes?: InvoicePayload['notes']
  goldRates?: Record<string, number>
  config?: PricingConfig
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
  /**
   * GST regime for the tax footer. Default jewellery = 3% (1.5% CGST + 1.5% SGST).
   * Loose diamonds = 1.5% (0.75% CGST + 0.75% SGST).
   */
  gstScheme?: InvoiceGstScheme
  /** Discount in ₹ subtracted after GST + round-off (payable only). */
  discount?: number
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
    'Unworn pieces may be returned within 15 days of delivery in their original packaging with all certificates for a full refund. Lifetime exchange is offered at prevailing metal and diamond rates, less making charges. Engraved and made-to-order pieces are final sale. Write to contact@thevairis.com to raise a request.',
}

/** Legal seller on every tax invoice — not env-overridable, not editable in admin. */
export const INVOICE_SELLER = {
  name: 'Vairis Fine Jewellery Private Limited',
  address:
    'Sy.130p&115/1p, Nanakramguda Rd, M, Gachibowli, Serilingampalle (M), Hyderabad, Telangana 500032',
  gstin: '36AALCV9240K1ZQ',
  email: 'contact@thevairis.com',
  phone: '+91 7075486464',
} as const

export function sellerDefaults(): InvoicePayload['seller'] {
  return { ...INVOICE_SELLER }
}

/** Stamp the hardcoded seller so clients cannot override company details. */
export function applyInvoiceSeller(payload: InvoicePayload): InvoicePayload {
  return { ...payload, seller: sellerDefaults() }
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

  // Order-creation snapshot — keep frozen component amounts; only scale by qty.
  if (line.lockedPricing) {
    const unitTaxable =
      Number(line.goldValue) +
      Number(line.wastage) +
      Number(line.making) +
      Number(line.stoneValue) +
      Number(line.miscCharges)
    return {
      ...line,
      quantity: qty,
      itemValue: Number(line.goldValue) + Number(line.stoneValue),
      makingPlusWastage: Number(line.making) + Number(line.wastage),
      taxable: unitTaxable * qty,
    }
  }

  const unit = calculatePrice(
    {
      weightGrams: line.weightGrams,
      makingChargePerGram: line.makingPerGram,
      flatMakingCharge: line.flatMaking,
      stoneCharges: Number(line.legacyStoneCharges) || 0,
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
    diamondValue: unit.diamondValue,
    otherStoneValue: unit.otherStoneValue,
    stones,
    itemValue: unit.goldValue + unit.stoneValue,
    makingPlusWastage: unit.making + unit.goldVA,
    taxable: unit.taxable * qty,
  }
}

export function totalsFromPayload(payload: InvoicePayload) {
  const lines = payload.lines.map((l) => recomputeLine(l, 'Wastage'))
  const taxable = lines.reduce((s, l) => s + l.taxable, 0)
  const discount = Math.max(0, Number(payload.discount) || 0)
  const tax = splitInvoiceTax(
    taxable,
    payload.placeOfSupply,
    normalizeInvoiceGstScheme(payload.gstScheme),
    discount,
  )
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
    gstScheme: 'JEWELLERY',
    discount: 0,
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
    diamondValue: 0,
    otherStoneValue: 0,
    leadIncentive: 0,
    miscCharges: 0,
    legacyStoneCharges: 0,
    itemValue: 0,
    makingPlusWastage: 0,
    taxable: 0,
  }
}

const EMPTY_PARTY: InvoiceParty = { name: '', lines: '', phone: '' }

function stoneRowsFromInputs(stones: StoneInput[], withExchange: boolean): InvoiceStoneRow[] {
  return stones.map((s) => {
    const std = Number(s.ratePerCarat)
    const exch = Number(s.ratePerCaratExchange)
    const rate = Number(withExchange ? exch : std)
    const carat = Number(s.caratWeight)
    return {
      label: s.typeLabel ?? 'Diamond',
      caratWeight: carat,
      ratePerCarat: rate,
      ratePerCaratStd: std,
      ratePerCaratExchange: exch,
      value: carat * rate,
      exchange: withExchange,
    }
  })
}

/**
 * Flip Exchange opted on an invoice line without unlocking live gold/making calc
 * and without changing Diamonds/Stones ₹ totals (those are already settled amounts).
 * Only updates the flag and the displayed ₹/ct (std ↔ exch) on the invoice.
 * PDP/checkout are untouched.
 */
export function applyInvoiceExchangeFlag(line: InvoiceLine, withExchange: boolean): InvoiceLine {
  const stones = line.stones.map((s) => {
    const std = Number(s.ratePerCaratStd ?? s.ratePerCarat)
    const exch = Number(s.ratePerCaratExchange ?? s.ratePerCarat)
    const ratePerCarat = withExchange ? exch : std
    return {
      ...s,
      exchange: withExchange,
      ratePerCaratStd: std,
      ratePerCaratExchange: exch,
      ratePerCarat,
      // Keep existing line value — diamonds ₹ total is already final.
    }
  })

  return {
    ...line,
    withExchange,
    stones,
  }
}

export function lineFromProduct(
  product: InvoiceProductInput,
  rates: Record<string, number>,
  config: PricingConfig,
): InvoiceLine {
  const metal = product.metalType
  const withExchange = product.withExchange ?? false
  const goldRate =
    product.goldRatePerGram ?? rates[goldRateKey(metal)] ?? rates[metal] ?? 0
  return recomputeLine(
    {
      ...blankLine(),
      productName: product.productName,
      itemCode: product.itemCode ?? '',
      sku: product.sku ?? '',
      metalLabel: metalLabel(metal),
      huid: product.huid ?? '',
      certs: product.certs ?? '',
      withExchange,
      quantity: product.quantity ?? 1,
      weightGrams: Number(product.weightGrams),
      goldRatePerGram: goldRate,
      wastagePct: Number(config.vaGoldPct),
      makingPerGram: Number(product.makingChargePerGram),
      flatMaking: Number(product.flatMakingCharge) || 0,
      miscCharges: Number(product.miscCharges) || 0,
      legacyStoneCharges: Number(product.stoneCharges) || 0,
      leadIncentive: Number(product.leadIncentive) || 0,
      stones: stoneRowsFromInputs(product.stones ?? [], withExchange),
    },
    config.vaLabel,
  )
}

export function lineFromCatalogueVariant(
  variant: InvoiceCatalogueVariant,
  rates: Record<string, number>,
  config: PricingConfig,
  extras?: { huid?: string; certs?: string; quantity?: number; withExchange?: boolean },
): InvoiceLine {
  return lineFromProduct(
    {
      productName: variant.productName,
      itemCode: variant.itemCode,
      sku: variant.sku,
      metalType: variant.metalType,
      weightGrams: variant.weightGrams,
      makingChargePerGram: variant.makingChargePerGram,
      flatMakingCharge: variant.flatMakingCharge,
      miscCharges: variant.miscCharges,
      stoneCharges: variant.stoneCharges,
      stones: variant.stones,
      huid: extras?.huid,
      certs: extras?.certs,
      quantity: extras?.quantity,
      withExchange: extras?.withExchange,
    },
    rates,
    config,
  )
}

type CreatedInvoiceProduct = {
  id: string
  name: string
  category: string
  itemCode: string | null
  variants: Array<{
    id: string
    metalType: string
    size: string | null
    sku: string
    weightGrams: unknown
    makingChargePerGram: unknown
    flatMakingCharge: unknown
    miscCharges: unknown
    stoneCharges: unknown
  }>
  stones?: Array<{
    caratWeight: unknown
    diamondRate?: { label: string; ratePerCarat: unknown; ratePerCaratExchange: unknown } | null
  }>
}

export function catalogueVariantFromCreatedProduct(product: CreatedInvoiceProduct): InvoiceCatalogueVariant | null {
  const v = product.variants[0]
  if (!v) return null
  return {
    variantId: v.id,
    productId: product.id,
    category: product.category,
    productName: product.name,
    itemCode: product.itemCode ?? '',
    sku: v.sku,
    metalType: v.metalType,
    size: v.size ?? '',
    label: `${product.name} — ${v.metalType}${v.size ? ` · ${v.size}` : ''} (${v.sku})`,
    weightGrams: Number(v.weightGrams),
    makingChargePerGram: Number(v.makingChargePerGram),
    flatMakingCharge: Number(v.flatMakingCharge),
    miscCharges: Number(v.miscCharges),
    stoneCharges: Number(v.stoneCharges),
    stones: (product.stones ?? [])
      .filter((s) => s.diamondRate)
      .map((s) => ({
        typeLabel: s.diamondRate!.label,
        caratWeight: Number(s.caratWeight),
        ratePerCarat: Number(s.diamondRate!.ratePerCarat),
        ratePerCaratExchange: Number(s.diamondRate!.ratePerCaratExchange),
      })),
  }
}

/**
 * Build a tax-invoice document from a product list (cart, checkout, or manual).
 * Same `calculatePrice` formula as PDP / cart / checkout.
 */
export function invoiceFromProducts(
  products: InvoiceProductInput[],
  ctx: InvoiceFromProductsContext = {},
): { payload: InvoicePayload; totals: ReturnType<typeof totalsFromPayload> } {
  const config = ctx.config ?? DEFAULT_PRICING_CONFIG
  const rates = ctx.goldRates ?? {}
  const billedTo = ctx.billedTo ?? EMPTY_PARTY
  const lines =
    products.length > 0
      ? products.map((p) => lineFromProduct(p, rates, config))
      : [blankLine()]
  const payload: InvoicePayload = {
    seller: sellerDefaults(),
    billedTo,
    shippedTo: ctx.shippedTo ?? { ...billedTo },
    payment: {
      method: ctx.payment?.method ?? '',
      reference: ctx.payment?.reference ?? '',
      received: ctx.payment?.received ?? '',
      status: ctx.payment?.status ?? 'Unpaid',
    },
    invoiceDate: ctx.invoiceDate ?? new Date().toISOString().slice(0, 10),
    placeOfSupply: ctx.placeOfSupply || 'Maharashtra (27)',
    gstScheme: 'JEWELLERY',
    notes: ctx.notes ?? { ...DEFAULT_INVOICE_NOTES },
    lines,
  }
  const totals = totalsFromPayload(payload)
  return { payload: { ...payload, lines: totals.lines }, totals }
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
  /** Order-level discount (₹) — copied onto the invoice payable. */
  discountAmount?: { toString(): string } | number | null
  /** Offline/manual settlement date (invoice Received On). */
  paymentReceivedAt?: Date | string | null
  user: { name: string; email: string }
  payment: { razorpayPaymentId: string | null; razorpayOrderId: string; status: string; createdAt: Date } | null
  /** Present when this is a split child — payment may live on the parent. */
  parent?: {
    payment: { razorpayPaymentId: string | null; razorpayOrderId: string; status: string; createdAt: Date } | null
    paymentReceivedAt?: Date | string | null
  } | null
  items: Array<{
    productName: string
    quantity: number
    withExchange: boolean
    /** Frozen at checkout — preferred source for invoice line amounts. */
    priceBreakdown?: unknown
    variant: {
      sku: string
      metalType: string
      weightGrams: { toString(): string } | number
      makingChargePerGram: { toString(): string } | number
      flatMakingCharge: { toString(): string } | number
      miscCharges: { toString(): string } | number
      stoneCharges?: { toString(): string } | number
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

/** Own Payment row, else parent’s (split delivery anchoring). */
function resolvedPayment(order: PrefillOrder): PrefillOrder['payment'] {
  return order.payment ?? order.parent?.payment ?? null
}

/** Manual `paymentReceivedAt`, else gateway Payment.createdAt (YYYY-MM-DD). */
function resolvedReceivedOn(order: PrefillOrder): string {
  const raw = order.paymentReceivedAt ?? order.parent?.paymentReceivedAt ?? null
  if (raw) {
    const d = raw instanceof Date ? raw : new Date(raw)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const payment = resolvedPayment(order)
  return payment ? payment.createdAt.toISOString().slice(0, 10) : ''
}

function stonesFromSnapshot(
  snap: OrderItemPriceSnapshot,
  catalogueStones?: StoneInput[],
): InvoiceStoneRow[] {
  return (snap.stoneLines ?? []).map((s) => {
    const label = s.typeLabel || 'Diamond'
    const match = catalogueStones?.find(
      (p) => (p.typeLabel ?? 'Diamond').toLowerCase() === label.toLowerCase(),
    )
    const snapRate = Number(s.ratePerCarat)
    const std = match ? Number(match.ratePerCarat) : snapRate
    const exch = match ? Number(match.ratePerCaratExchange) : snapRate
    const exchange = Boolean(snap.withExchange)
    return {
      label,
      caratWeight: Number(s.caratWeight),
      ratePerCarat: snapRate,
      ratePerCaratStd: std,
      ratePerCaratExchange: exch,
      value: Number(s.value),
      exchange,
    }
  })
}

/**
 * Build an invoice line from an order item.
 * Prefers OrderItem.priceBreakdown (frozen at create); falls back to live rates.
 */
export function lineFromOrderItem(
  item: PrefillOrder['items'][number],
  rates: Record<string, number>,
  config: PricingConfig,
): InvoiceLine {
  const v = item.variant
  const metal = v.metalType
  const withExchange = item.withExchange
  const snap = isOrderItemPriceSnapshot(item.priceBreakdown) ? item.priceBreakdown : null

  if (snap) {
    const wastagePct =
      snap.goldValue > 0 ? (snap.goldVA / snap.goldValue) * 100 : Number(config.vaGoldPct)
    const catalogueStones = toStoneInputs(v.product.stones)
    const snapStones = stonesFromSnapshot(snap, catalogueStones)
    const stones =
      snapStones.length > 0
        ? snapStones
        : stoneRowsFromInputs(catalogueStones, withExchange)
    const gems = splitGemValues(snap)

    return recomputeLine(
      {
        ...blankLine(),
        productName: item.productName,
        itemCode: v.product.itemCode ?? '',
        sku: v.sku,
        metalLabel: metalLabel(snap.metalType || metal),
        withExchange: Boolean(snap.withExchange),
        quantity: item.quantity,
        weightGrams: Number(snap.weightGrams) || Number(v.weightGrams),
        goldRatePerGram: Number(snap.goldRatePerGram),
        goldValue: Number(snap.goldValue),
        wastagePct,
        wastage: Number(snap.goldVA),
        // Snapshot stores total making — prefer flat so unlock matches order amounts
        // rather than catalogue ₹/g (can disagree on manual selling breakdowns).
        makingPerGram: 0,
        flatMaking: Number(snap.making),
        making: Number(snap.making),
        stones,
        stoneValue: Number(snap.stoneValue),
        diamondValue: gems.diamonds,
        otherStoneValue: gems.stones,
        miscCharges: Number(snap.miscCharges),
        legacyStoneCharges: gems.stones,
        leadIncentive: 0,
        itemValue: Number(snap.goldValue) + Number(snap.stoneValue),
        makingPlusWastage: Number(snap.making) + Number(snap.goldVA),
        taxable: Number(snap.taxable),
        lockedPricing: true,
      },
      snap.vaLabel || config.vaLabel,
    )
  }

  return lineFromProduct(
    {
      productName: item.productName,
      itemCode: v.product.itemCode ?? '',
      sku: v.sku,
      metalType: metal,
      withExchange,
      quantity: item.quantity,
      weightGrams: Number(v.weightGrams),
      makingChargePerGram: Number(v.makingChargePerGram),
      flatMakingCharge: Number(v.flatMakingCharge),
      miscCharges: Number(v.miscCharges),
      stoneCharges: Number(v.stoneCharges ?? 0),
      stones: toStoneInputs(v.product.stones),
    },
    rates,
    config,
  )
}

export function payloadFromOrder(
  order: PrefillOrder,
  rates: Record<string, number>,
  config: PricingConfig,
): InvoicePayload {
  const payment = resolvedPayment(order)
  const paid =
    payment?.status === 'CAPTURED' ||
    ['PAYMENT_CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status)
  const party: InvoiceParty = {
    name: order.contactName || order.user.name,
    lines: addressBlock(order),
    phone: order.contactPhone ? `+91 ${order.contactPhone}` : '',
  }
  const lines = flattenItems(order).map((item) => lineFromOrderItem(item, rates, config))
  const discountRaw = order.discountAmount != null ? Number(order.discountAmount) : 0
  const payload: InvoicePayload = {
    seller: sellerDefaults(),
    billedTo: party,
    shippedTo: { ...party },
    payment: {
      method: payment ? 'Online' : paid ? 'Offline' : '',
      reference: payment?.razorpayPaymentId || payment?.razorpayOrderId || '',
      received: resolvedReceivedOn(order),
      status: paid ? 'Paid in full' : 'Unpaid',
    },
    // Start from the order placed date (admin can still edit on the form).
    invoiceDate: order.createdAt.toISOString().slice(0, 10),
    placeOfSupply: /maharashtra/i.test(order.state)
      ? 'Maharashtra (27)'
      : order.state || 'Maharashtra (27)',
    gstScheme: 'JEWELLERY',
    discount: discountRaw > 0 ? discountRaw : undefined,
    notes: { ...DEFAULT_INVOICE_NOTES },
    lines: lines.length > 0 ? lines : [blankLine()],
  }
  const totals = totalsFromPayload(payload)
  return { ...payload, lines: totals.lines }
}

export function invoiceStatusFromPayload(payload: InvoicePayload): InvoiceStatus {
  return /paid/i.test(payload.payment.status) ? 'PAID' : 'UNPAID'
}
