import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { initiateRefund } from '@/lib/refunds'

export const dynamic = 'force-dynamic'

const refundSchema = z.object({
  kind: z.enum(['deposit', 'full', 'partial']),
  amount: z.number().positive().optional(),
  reason: z.string().trim().min(3, 'Reason is required'),
})

/**
 * POST /api/admin/orders/[id]/refund — start a refund via the ledger
 * (lib/refunds.ts). Gateway refunds complete via the refund.processed
 * webhook; offline refunds are marked complete immediately.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const parsed = refundSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid refund' }, { status: 400 })
  }

  const result = await initiateRefund({
    orderId: id,
    kind: parsed.data.kind.toUpperCase() as 'DEPOSIT' | 'FULL' | 'PARTIAL',
    amount: parsed.data.amount,
    reason: parsed.data.reason,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code })
  return NextResponse.json({ ok: true, amount: result.amount })
}
