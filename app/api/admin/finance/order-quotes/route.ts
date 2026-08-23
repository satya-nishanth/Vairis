import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceApi } from '@/lib/finance-auth'
import { getOrderItemQuotes } from '@/lib/finance-order-quotes'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error

  const orderId = req.nextUrl.searchParams.get('orderId')?.trim()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const items = await getOrderItemQuotes(orderId)
  if (items.length === 0) {
    // Distinguish missing order vs empty cart
    const { prisma } = await import('@/lib/prisma')
    const exists = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({ orderId, items })
}
