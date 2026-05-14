import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rate18k = await prisma.goldRate.findUnique({ where: { metalType: 'GOLD_18K' } })

  if (!rate18k) {
    return NextResponse.json({ error: 'Gold rates not available' }, { status: 503 })
  }

  const per18kGram = Number(rate18k.ratePerGram)
  const per14kGram = Number(
    (await prisma.goldRate.findUnique({ where: { metalType: 'GOLD_14K' } }))?.ratePerGram
    ?? per18kGram * (14 / 18)
  )

  return NextResponse.json({
    rates: {
      '18K': Math.round(per18kGram),
      '14K': Math.round(per14kGram),
    },
    unit: '₹/gram',
    fetchedAt: rate18k.fetchedAt.toISOString(),
  })
}
