import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MIN_SYNC_INTERVAL_MINUTES = 30

function isAuthorised(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.GOLD_SYNC_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Rate limit: reject if synced within last 30 minutes
  const last = await prisma.goldRate.findUnique({ where: { metalType: 'GOLD_18K' } })
  if (last) {
    const minutesSince = (Date.now() - last.fetchedAt.getTime()) / 60000
    if (minutesSince < MIN_SYNC_INTERVAL_MINUTES) {
      return NextResponse.json(
        { error: `Rate limited — synced ${Math.round(minutesSince)}m ago, next sync in ${Math.round(MIN_SYNC_INTERVAL_MINUTES - minutesSince)}m` },
        { status: 429 }
      )
    }
  }

  const apiKey = process.env.METAL_PRICE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'METAL_PRICE_API_KEY not set' }, { status: 500 })
  }

  const res = await fetch(
    `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}&base=XAU&currencies=INR`,
    { cache: 'no-store' }
  )
  if (!res.ok) {
    return NextResponse.json({ error: `Metal price API error: ${res.status}` }, { status: 502 })
  }

  const json = await res.json()
  if (!json.success || !json.rates?.INR) {
    return NextResponse.json({ error: 'Unexpected API response', detail: json }, { status: 502 })
  }

  // 1 troy oz XAU = 31.1035g pure gold (24K)
  const per24kGram = json.rates.INR / 31.1035

  await Promise.all([
    prisma.goldRate.upsert({
      where: { metalType: 'GOLD_18K' },
      update: { ratePerGram: per24kGram * (18 / 24) },
      create: { metalType: 'GOLD_18K', ratePerGram: per24kGram * (18 / 24) },
    }),
    prisma.goldRate.upsert({
      where: { metalType: 'GOLD_14K' },
      update: { ratePerGram: per24kGram * (14 / 24) },
      create: { metalType: 'GOLD_14K', ratePerGram: per24kGram * (14 / 24) },
    }),
  ])

  return NextResponse.json({
    updated: true,
    rates: {
      '18K': Math.round(per24kGram * (18 / 24)),
      '14K': Math.round(per24kGram * (14 / 24)),
    },
    fetchedAt: new Date().toISOString(),
  })
}
