import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'
import { orderCost, orderProfit } from '@/lib/finance'

export const dynamic = 'force-dynamic'

const PAID_TO = ['VAIRIS_BANK', 'ANIL', 'SURYA', 'VASU'] as const

const upsertSchema = z.object({
  orderId: z.string().min(1),
  goldCost: z.number().min(0),
  diamondCost: z.number().min(0),
  stonesCost: z.number().min(0),
  sellingPrice: z.number().min(0),
  customerPaidTo: z.enum(PAID_TO),
})

function serialize(row: {
  id: string
  orderId: string
  goldCost: { toString(): string } | number
  diamondCost: { toString(): string } | number
  stonesCost: { toString(): string } | number
  sellingPrice: { toString(): string } | number
  customerPaidTo: string
  createdAt: Date
  updatedAt: Date
  order?: { contactName: string; createdAt: Date; grandTotal: { toString(): string } | number }
}) {
  const gold = Number(row.goldCost)
  const diamond = Number(row.diamondCost)
  const stones = Number(row.stonesCost)
  const sp = Number(row.sellingPrice)
  const cp = orderCost(gold, diamond, stones)
  return {
    id: row.id,
    orderId: row.orderId,
    goldCost: gold,
    diamondCost: diamond,
    stonesCost: stones,
    sellingPrice: sp,
    cost: cp,
    profit: orderProfit(sp, cp),
    customerPaidTo: row.customerPaidTo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    order: row.order
      ? {
          contactName: row.order.contactName,
          createdAt: row.order.createdAt.toISOString(),
          grandTotal: Number(row.order.grandTotal),
        }
      : undefined,
  }
}

export async function GET() {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const rows = await prisma.orderFinance.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { order: { select: { contactName: true, createdAt: true, grandTotal: true } } },
  })
  return NextResponse.json(rows.map(serialize))
}

export async function POST(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const parsed = upsertSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  const d = parsed.data
  const order = await prisma.order.findUnique({ where: { id: d.orderId }, select: { id: true } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const row = await prisma.orderFinance.upsert({
    where: { orderId: d.orderId },
    create: {
      orderId: d.orderId,
      goldCost: d.goldCost,
      diamondCost: d.diamondCost,
      stonesCost: d.stonesCost,
      sellingPrice: d.sellingPrice,
      customerPaidTo: d.customerPaidTo,
    },
    update: {
      goldCost: d.goldCost,
      diamondCost: d.diamondCost,
      stonesCost: d.stonesCost,
      sellingPrice: d.sellingPrice,
      customerPaidTo: d.customerPaidTo,
    },
    include: { order: { select: { contactName: true, createdAt: true, grandTotal: true } } },
  })
  return NextResponse.json(serialize(row))
}
