import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAppUser } from '@/lib/auth'
import { validatePromo } from '@/lib/promo'

export const dynamic = 'force-dynamic'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  code: z.string().trim().min(1).max(40),
  cartTotal: z.number().nonnegative(),
})

/** POST /api/promo/validate — cart-time preview. Final check re-runs at checkout. */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'promo', 20)
  if (limited) return limited

  const user = await getAppUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const result = await validatePromo(parsed.data.code, user.id, parsed.data.cartTotal)
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 })

  return NextResponse.json({
    code: result.promo.code,
    description: result.promo.description,
    discount: result.discount,
  })
}
