import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users?q=… — customer lookup for manual order creation
 * (WhatsApp sales). Matches email or name, case-insensitive, max 10.
 * The customer must already have an account — that's what lets them see
 * the order under My Orders and use /track-order.
 */
export async function GET(req: NextRequest) {
  await requireAdmin()

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, email: true, name: true, mobile: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(users)
}
