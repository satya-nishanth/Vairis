import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceApi } from '@/lib/finance-auth'
import {
  listRecentFinanceOrders,
  listRecentFinanceOrdersForAllocation,
  searchFinanceOrders,
  searchFinanceOrdersForAllocation,
} from '@/lib/finance-order-search'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const recent = req.nextUrl.searchParams.get('recent') === '1'
  const openOnly = req.nextUrl.searchParams.get('open') === '1'
  const forAllocate = req.nextUrl.searchParams.get('scope') === 'allocate'

  let rows = forAllocate
    ? q.length >= 2
      ? await searchFinanceOrdersForAllocation(q)
      : recent
        ? await listRecentFinanceOrdersForAllocation(24)
        : []
    : q.length >= 2
      ? await searchFinanceOrders(q)
      : recent
        ? await listRecentFinanceOrders(24)
        : []

  if (openOnly) {
    rows = rows.filter((r) => r.paymentStatus === 'unpaid' || r.paymentStatus === 'partial')
  }

  return NextResponse.json(rows)
}
