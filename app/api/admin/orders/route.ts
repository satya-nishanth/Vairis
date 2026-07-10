import { NextRequest, NextResponse } from 'next/server'
import type { OrderStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** GET /api/admin/orders?status=SHIPPED — admin order list (all statuses when omitted). */
export async function GET(req: NextRequest) {
  await requireAdmin()

  const status = req.nextUrl.searchParams.get('status') as OrderStatus | null
  const orders = await prisma.order.findMany({
    where: status ? { status } : undefined,
    include: {
      items: true,
      payment: { select: { status: true, refundedAmount: true } },
      user: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json(orders)
}
