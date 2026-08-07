import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAppUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const EVENT_NAMES = [
  'page_view',
  'pdp_view',
  'add_to_cart',
  'begin_checkout',
  'purchase',
] as const

const schema = z.object({
  name: z.enum(EVENT_NAMES),
  path: z.string().max(300).optional(),
  productId: z.string().max(64).optional(),
  sessionId: z.string().max(64).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})

/**
 * POST /api/events — first-party analytics ingestion (AnalyticsEvent table).
 * Fire-and-forget from the client; whitelisted event names only. Search
 * events are logged server-side by /api/search.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 })
  const d = parsed.data

  const user = await getAppUser().catch(() => null)

  await prisma.analyticsEvent
    .create({
      data: {
        name: d.name,
        path: d.path?.slice(0, 300) ?? null,
        productId: d.productId ?? null,
        userId: user?.id ?? null,
        sessionId: d.sessionId ?? null,
        meta: (d.meta ?? {}) as object,
      },
    })
    .catch(() => {})

  return NextResponse.json({ ok: true })
}
