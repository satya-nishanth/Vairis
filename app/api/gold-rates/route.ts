import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { METAL_PURITIES } from '@/lib/metal'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await prisma.goldRate.findMany()
  const byType = Object.fromEntries(rows.map((r) => [r.metalType, r]))

  const rate18k = byType.GOLD_18K
  if (!rate18k) {
    return NextResponse.json({ error: 'Gold rates not available' }, { status: 503 })
  }

  const per18kGram = Number(rate18k.ratePerGram)
  const rates: Record<string, number> = {}

  for (const p of METAL_PURITIES) {
    const row = byType[p.value]
    if (row) {
      rates[p.label] = Math.round(Number(row.ratePerGram))
    } else {
      rates[p.label] = Math.round(per18kGram * (p.karat / 18))
    }
  }

  return NextResponse.json({
    rates,
    unit: '₹/gram',
    fetchedAt: rate18k.fetchedAt.toISOString(),
  })
}
