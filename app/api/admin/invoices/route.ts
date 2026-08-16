import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPricingConfig } from '@/lib/pricing-data'
import {
  blankPayload,
  invoiceStatusFromPayload,
  payloadFromOrder,
  totalsFromPayload,
  type InvoicePayload,
  type PrefillOrder,
} from '@/lib/invoice-document'
import { nextInvoiceNumber } from '@/lib/invoice-number'

export const dynamic = 'force-dynamic'

const ORDER_INCLUDE = {
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

async function loadPrefill(orderId?: string | null): Promise<InvoicePayload> {
  if (!orderId) return blankPayload()
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  })
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 })
  const [goldRates, config] = await Promise.all([prisma.goldRate.findMany(), getPricingConfig()])
  const rates = Object.fromEntries(goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]))
  return payloadFromOrder(order as unknown as PrefillOrder, rates, config)
}

function serializeInvoice(inv: {
  id: string
  number: string
  orderId: string | null
  status: string
  payload: unknown
  taxableValue: { toString(): string } | number
  gstAmount: { toString(): string } | number
  grandTotal: { toString(): string } | number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: inv.id,
    number: inv.number,
    orderId: inv.orderId,
    status: inv.status,
    payload: inv.payload,
    taxableValue: Number(inv.taxableValue),
    gstAmount: Number(inv.gstAmount),
    grandTotal: Number(inv.grandTotal),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  await requireAdmin()
  const orderId = req.nextUrl.searchParams.get('orderId')
  const invoices = await prisma.invoice.findMany({
    where: orderId ? { orderId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json(invoices.map(serializeInvoice))
}

const createSchema = z.object({
  orderId: z.string().optional().nullable(),
  payload: z.unknown().optional(),
})

export async function POST(req: NextRequest) {
  await requireAdmin()
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  try {
    const payload = (parsed.data.payload as InvoicePayload | undefined) ?? (await loadPrefill(parsed.data.orderId))
    const totals = totalsFromPayload(payload)
    const number = await nextInvoiceNumber()
    const invoice = await prisma.invoice.create({
      data: {
        number,
        orderId: parsed.data.orderId || null,
        status: invoiceStatusFromPayload(payload),
        payload: { ...payload, lines: totals.lines } as object,
        taxableValue: totals.taxable,
        gstAmount: totals.gstAmount,
        grandTotal: totals.grandTotal,
      },
    })
    return NextResponse.json(serializeInvoice(invoice), { status: 201 })
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500
    const message = err instanceof Error ? err.message : 'Create failed'
    return NextResponse.json({ error: message }, { status })
  }
}
