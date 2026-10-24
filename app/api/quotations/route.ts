import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  createWithUniqueDisplayId,
  createQuoteThread,
  mentionAssignee,
  notifyQuotationUpdate,
  quotationMilestone,
} from '@/lib/quotations'

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
      WHERE "customerMobile" = ${d.customerMobile} AND status IN ('REQUESTED', 'QUOTED', 'ACCEPTED')
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
    await tx.quotationEvent.create({
      data: {
        quotationId: quotation.id,
        type: 'CREATED',
        message: 'Created (WEBSITE)',
        meta: { source: 'WEBSITE' },
      },
    })
    return { quotation, created: true }
  })

  if (result.created) {
    try {
      const threadId = await createQuoteThread(`${result.quotation.displayId} · vairis · ${d.customerName}`)
      const withThread = await prisma.quotation.update({
        where: { id: result.quotation.id },
        data: { discordThreadId: threadId },
      })
      result.quotation = withThread
      await notifyQuotationUpdate(
        withThread,
        `${mentionAssignee()} ${quotationMilestone(
          'Quotation created',
          `Website · ${d.customerName}\n**Mobile:** ${d.customerMobile}${d.details ? `\n**Details:** ${d.details}` : ''}`,
        )}`,
      )
    } catch (err) {
      // Never blocks the response — reminderPoll retries thread creation (a later task).
      console.error('[api/quotations] Discord thread creation failed', err)
    }
  } else if (d.details) {
    // Dedup returned an already-open quotation (one per mobile) — this is a second enquiry,
    // possibly for a different product. Record it instead of silently dropping it: append to
    // the quotation's details and, if the thread exists, post it there too so the assignee sees
    // both. Doesn't create a second quotation/thread — that stays one-per-mobile per spec.
    const appendedDetails = [result.quotation.details, d.details].filter(Boolean).join('\n---\n')
    try {
      await prisma.quotation.update({
        where: { id: result.quotation.id },
        data: { details: appendedDetails },
      })
      result.quotation = { ...result.quotation, details: appendedDetails }
      await prisma.quotationEvent.create({
        data: {
          quotationId: result.quotation.id,
          type: 'NOTE',
          message: `Additional enquiry: ${d.details.slice(0, 280)}`,
        },
      })
      await notifyQuotationUpdate(
        result.quotation,
        `${mentionAssignee()} Additional enquiry from ${result.quotation.customerName ?? d.customerName}\n**Details:** ${d.details}`,
      )
    } catch (err) {
      console.error('[api/quotations] Failed to record additional enquiry on existing quotation', err)
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
