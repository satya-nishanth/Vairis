import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { searchInventoryOrders } from '@/lib/inventory-order-search'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  await requireAdmin()
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])
  return NextResponse.json(await searchInventoryOrders(q))
}
