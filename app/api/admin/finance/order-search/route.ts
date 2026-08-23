import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceApi } from '@/lib/finance-auth'
import { searchFinanceOrders } from '@/lib/finance-order-search'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])
  return NextResponse.json(await searchFinanceOrders(q))
}
