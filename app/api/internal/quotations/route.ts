import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isInternalApiAuthorized } from '@/lib/quotations'

export const dynamic = 'force-dynamic'

/** GET /api/internal/quotations — bot-only. Every open quotation; closed ones simply disappear. */
export async function GET(req: NextRequest) {
  if (!isInternalApiAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quotations = await prisma.quotation.findMany({
    where: { status: { in: ['REQUESTED', 'QUOTED'] } },
    select: {
      id: true,
      displayId: true,
      status: true,
      customerMobile: true,
      discordThreadId: true,
      lastReminderAt: true,
      reminderCount: true,
      escalatedAt: true,
      createdAt: true,
    },
  })
  return NextResponse.json(quotations)
}
