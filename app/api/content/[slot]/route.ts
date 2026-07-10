import { NextRequest, NextResponse } from 'next/server'
import { getBanner, KNOWN_SLOTS } from '@/lib/site-content'

export const dynamic = 'force-dynamic'

/**
 * GET /api/content/[slot] — public banner content for client components
 * (PromoBar renders inside client trees, so it can't query the DB
 * directly). Server components should call getBanner() instead.
 * Unknown slots 404 — this endpoint only serves the allow-list.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slot: string }> }) {
  const { slot } = await params
  if (!KNOWN_SLOTS.some((s) => s.slot === slot)) {
    return NextResponse.json({ error: 'Unknown slot' }, { status: 404 })
  }
  const banner = await getBanner(slot)
  return NextResponse.json(
    { banner },
    // Cache at the edge briefly — banner edits show within a minute.
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } },
  )
}
