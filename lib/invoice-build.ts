import { prisma } from '@/lib/prisma'
import { getPricingConfig, toStoneInputs } from '@/lib/pricing-data'
import {
  blankPayload,
  invoiceFromProducts,
  payloadFromOrder,
  totalsFromPayload,
  type InvoiceFromProductsContext,
  type InvoicePayload,
  type InvoiceProductInput,
  type PrefillOrder,
} from '@/lib/invoice-document'

export const INVOICE_ORDER_INCLUDE = {
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
      weightGrams: v.weightGrams,
      makingChargePerGram: v.makingChargePerGram,
      flatMakingCharge: v.flatMakingCharge,
      miscCharges: v.miscCharges,
      stoneCharges: v.stoneCharges,
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
