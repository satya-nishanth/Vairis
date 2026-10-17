import { prisma } from '@/lib/prisma'
import { getPricingConfig, toStoneInputs } from '@/lib/pricing-data'
import type { PricingConfig } from '@/lib/pricing'
import { resolveMiscChargeLines } from '@/lib/misc-charges'
import {
  blankPayload,
  invoiceFromProducts,
  payloadFromOrder,
  totalsFromPayload,
  type InvoiceCatalogueVariant,
  type InvoiceDiamondRateOption,
  type InvoiceFromProductsContext,
  type InvoicePayload,
  type InvoiceProductInput,
  type PrefillOrder,
} from '@/lib/invoice-document'

export type InvoiceCatalogue = {
  variants: InvoiceCatalogueVariant[]
  goldRates: Record<string, number>
  config: PricingConfig
  diamondRates: InvoiceDiamondRateOption[]
}

export async function loadInvoiceCatalogue(): Promise<InvoiceCatalogue> {
  const [products, goldRateRows, config, diamondRows] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: {
        variants: { orderBy: { metalType: 'asc' } },
        stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.goldRate.findMany(),
    getPricingConfig(),
    prisma.diamondRate.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ])
  const goldRates = Object.fromEntries(goldRateRows.map((r) => [r.metalType, Number(r.ratePerGram)]))
  const variants: InvoiceCatalogueVariant[] = products.flatMap((p) =>
    p.variants.map((v) => ({
      variantId: v.id,
      productId: p.id,
      category: p.category,
      productName: p.name,
      itemCode: p.itemCode ?? '',
      sku: v.sku,
      metalType: v.metalType,
      size: v.size ?? '',
      label: `${p.name} — ${v.metalType}${v.size ? ` · ${v.size}` : ''} (${v.sku})`,
      weightGrams: Number(v.weightGrams),
      makingChargePerGram: Number(v.makingChargePerGram),
      flatMakingCharge: Number(v.flatMakingCharge),
      miscCharges: Number(v.miscCharges),
      miscLines: resolveMiscChargeLines(v.miscChargeLines, Number(v.miscCharges)),
      certificationCharges: Number(v.certificationCharges ?? 0),
      packagingCharges: Number(v.packagingCharges ?? 0),
      deliveryCharges: Number(v.deliveryCharges ?? 0),
      stoneCharges: Number(v.stoneCharges),
      stones: toStoneInputs(p.stones).map((s) => ({
        typeLabel: s.typeLabel ?? 'Diamond',
        caratWeight: Number(s.caratWeight),
        ratePerCarat: Number(s.ratePerCarat),
        ratePerCaratExchange: Number(s.ratePerCaratExchange),
      })),
    })),
  )
  return {
    variants,
    goldRates,
    config,
    diamondRates: diamondRows.map((r) => ({
      id: r.id,
      label: r.label,
      ratePerCarat: Number(r.ratePerCarat),
      ratePerCaratExchange: Number(r.ratePerCaratExchange),
    })),
  }
}

export const INVOICE_ORDER_INCLUDE = {
  user: { select: { name: true, email: true } },
  payment: true,
  // Split children have no Payment row — gateway payment lives on the parent
  // (same anchoring as lib/refunds resolvePayment / order detail UI).
  parent: { include: { payment: true } },
  items: {
    include: {
      variant: {
        include: {
          product: {
            include: {
              stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' as const } },
            },
          },
        },
      },
    },
  },
  children: {
    include: {
      user: { select: { name: true, email: true } },
      payment: true,
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' as const } },
                },
              },
            },
          },
        },
      },
    },
  },
} as const

export type InvoiceVariantItem = {
  variantId: string
  quantity?: number
  withExchange?: boolean
}

async function goldRatesAndConfig(
  ctx: Pick<InvoiceFromProductsContext, 'goldRates' | 'config'>,
) {
  const [goldRates, config] = await Promise.all([
    ctx.goldRates
      ? Promise.resolve(ctx.goldRates)
      : prisma.goldRate.findMany().then((rows) =>
          Object.fromEntries(rows.map((r) => [r.metalType, Number(r.ratePerGram)])),
        ),
    ctx.config ? Promise.resolve(ctx.config) : getPricingConfig(),
  ])
  return { goldRates, config }
}

/** Load live gold rates + wastage settings, then run `invoiceFromProducts`. */
export async function buildInvoiceFromProducts(
  products: InvoiceProductInput[],
  ctx: InvoiceFromProductsContext = {},
) {
  const { goldRates, config } = await goldRatesAndConfig(ctx)
  return invoiceFromProducts(products, { ...ctx, goldRates, config })
}

/**
 * Order-journey helper: cart / checkout / manual order lines (variant ids)
 * → tax invoice using catalogue weights, stones, and current gold rates.
 * Prefer `invoiceFromOrderId` when an order already exists — that path uses
 * frozen OrderItem.priceBreakdown instead of live rates.
 */
export async function invoiceFromVariants(
  items: InvoiceVariantItem[],
  ctx: InvoiceFromProductsContext = {},
) {
  const ids = [...new Set(items.map((i) => i.variantId))]
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: ids } },
    include: {
      product: {
        include: {
          stones: { include: { diamondRate: true }, orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  })
  const byId = new Map(variants.map((v) => [v.id, v]))
  const products: InvoiceProductInput[] = items.map((item) => {
    const v = byId.get(item.variantId)
    if (!v) {
      throw Object.assign(new Error(`Variant not found: ${item.variantId}`), { status: 404 })
    }
    return {
      productName: v.product.name,
      itemCode: v.product.itemCode ?? '',
      sku: v.sku,
      metalType: v.metalType,
      quantity: item.quantity ?? 1,
      withExchange: item.withExchange ?? false,
      weightGrams: Number(v.weightGrams),
      makingChargePerGram: Number(v.makingChargePerGram),
      flatMakingCharge: Number(v.flatMakingCharge),
      miscCharges: Number(v.miscCharges),
      miscLines: resolveMiscChargeLines(v.miscChargeLines, Number(v.miscCharges)),
      certificationCharges: Number(v.certificationCharges ?? 0),
      packagingCharges: Number(v.packagingCharges ?? 0),
      deliveryCharges: Number(v.deliveryCharges ?? 0),
      stoneCharges: Number(v.stoneCharges),
      stones: toStoneInputs(v.product.stones),
    }
  })
  return buildInvoiceFromProducts(products, ctx)
}

export async function invoiceFromOrderId(orderId: string): Promise<{
  payload: InvoicePayload
  totals: ReturnType<typeof totalsFromPayload>
} | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: INVOICE_ORDER_INCLUDE,
  })
  if (!order) return null
  const { goldRates, config } = await goldRatesAndConfig({})
  const payload = payloadFromOrder(order as unknown as PrefillOrder, goldRates, config)
  const totals = totalsFromPayload(payload)
  return { payload: { ...payload, lines: totals.lines }, totals }
}

export async function invoicePrefill(orderId?: string | null): Promise<InvoicePayload> {
  if (!orderId) return blankPayload()
  const built = await invoiceFromOrderId(orderId)
  if (!built) throw Object.assign(new Error('Order not found'), { status: 404 })
  return built.payload
}
