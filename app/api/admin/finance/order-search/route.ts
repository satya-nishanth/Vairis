import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFinanceApi } from '@/lib/finance-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { id: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { contactPhone: { contains: q } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ],
    },
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      contactName: true,
      contactPhone: true,
      grandTotal: true,
      status: true,
      createdAt: true,
      finance: { select: { id: true } },
    },
  })
  return NextResponse.json(
    orders.map((o) => ({
      id: o.id,
      contactName: o.contactName,
      contactPhone: o.contactPhone,
      grandTotal: Number(o.grandTotal),
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      hasSheet: Boolean(o.finance),
    })),
  )
}
