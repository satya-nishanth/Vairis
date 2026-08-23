import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createWithUniqueDisplayId, createQuoteThread, postToThread, mentionAssignee } from '@/lib/quotations'

export const dynamic = 'force-dynamic'

const publicQuotationSchema = z.object({
  customerName: z.string().trim().min(1).max(100),
  customerMobile: z.string().trim().regex(/^\d{7,15}$/, 'Valid mobile number required'),
  details: z.string().trim().max(1000).optional(),
})

/**
 * POST /api/quotations — public. Used by the PDP "Enquire on WhatsApp" modal AND by the bot's
 * WhatsApp keyword-fallback path (no ref in the message). orderType is always VAIRIS here —
 * Customisation quotes only come from the admin manual-intake form.
 */
export async function POST(req: NextRequest) {
  const parsed = publicQuotationSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const d = parsed.data

  const result = await prisma.$transaction(async (tx) => {
    // Dedup: one open quotation per mobile. FOR UPDATE locks any existing open row so a burst of
    // rapid submissions from the same phone can't race past this check.
    const existingRows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Quotation"
      WHERE "customerMobile" = ${d.customerMobile} AND status IN ('REQUESTED', 'QUOTED')
      FOR UPDATE
    `
    if (existingRows.length > 0) {
      const existing = await tx.quotation.findUniqueOrThrow({ where: { id: existingRows[0].id } })
      return { quotation: existing, created: false }
    }

    const quotation = await createWithUniqueDisplayId(
      { customerName: d.customerName, customerMobile: d.customerMobile },
      (displayId) =>
        tx.quotation.create({
          data: {
            displayId,
            source: 'WEBSITE',
            orderType: 'VAIRIS',
            customerName: d.customerName,
            customerMobile: d.customerMobile,
            details: d.details,
          },
        }),
    )
    return { quotation, created: true }
  })

  if (result.created) {
    try {
      const threadId = await createQuoteThread(`${result.quotation.displayId} · vairis · ${d.customerName}`)
      await prisma.quotation.update({
        where: { id: result.quotation.id },
        data: { discordThreadId: threadId },
      })
      result.quotation = { ...result.quotation, discordThreadId: threadId }
      await postToThread(
        threadId,
        `${mentionAssignee()} New website quotation request\n**Customer:** ${d.customerName}\n**Mobile:** ${d.customerMobile}${d.details ? `\n**Details:** ${d.details}` : ''}`,
      )
    } catch (err) {
      // Never blocks the response — reminderPoll retries thread creation (a later task).
      console.error('[api/quotations] Discord thread creation failed', err)
    }
  }

  return NextResponse.json(
    {
      id: result.quotation.id,
      displayId: result.quotation.displayId,
      status: result.quotation.status,
      customerMobile: result.quotation.customerMobile,
      discordThreadId: result.quotation.discordThreadId,
    },
    { status: result.created ? 201 : 200 },
  )
}
