import { NextRequest, NextResponse } from 'next/server'
import { runFinanceDigest } from '@/lib/finance-digest'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/finance-digest — daily finance dashboard warnings → Discord.
 * Cron-called (GitHub Actions — never Vercel cron), Bearer-authed with
 * FINANCE_DIGEST_SECRET. Posts via DISCORD_FINANCE_WEBHOOK_URL on the app.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.FINANCE_DIGEST_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const result = await runFinanceDigest()
    return NextResponse.json({
      ok: true,
      posted: result.posted,
      pendingSheets: result.alerts.pendingSheetsCount,
      mismatches: result.alerts.mismatches.length,
      forReview: result.alerts.forReviewCount,
    })
  } catch (err) {
    console.error('[finance-digest]', err)
    const message = err instanceof Error ? err.message : 'Digest failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
