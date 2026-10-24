import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { expandDiscordHandles, notifyQuotationUpdate } from '@/lib/quotations'

export const dynamic = 'force-dynamic'

const commentSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  attachmentUrls: z.array(z.string().url()).max(8).optional(),
  kind: z.enum(['INTERNAL', 'CUSTOMER_RESPONSE', 'OUR_RESPONSE']).default('INTERNAL'),
})

/** POST — admin desk comment. @handles expand to Discord mentions on notify. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  const { id } = await params
  const parsed = commentSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }

  const quotation = await prisma.quotation.findUnique({ where: { id } })
  if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })

  const attachmentUrls = parsed.data.attachmentUrls ?? []
  const kind = parsed.data.kind
  const snippet = parsed.data.body.slice(0, 280)

  const discordUsers = await prisma.quotationDiscordUser.findMany({
    where: { active: true },
    select: { handle: true, discordUserId: true },
  })
  const { discordBody, mentionedHandles } = expandDiscordHandles(parsed.data.body, discordUsers)

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.quotationComment.create({
      data: {
        quotationId: id,
        body: parsed.data.body,
        authorEmail: auth.email,
        kind,
        attachmentUrls,
      },
    })

    if (kind === 'CUSTOMER_RESPONSE') {
      await tx.quotationEvent.create({
        data: {
          quotationId: id,
          type: 'RESPONSE',
          message: `Customer Replied: ${snippet}`,
          meta: { commentId: created.id, kind, mentionedHandles },
          actorEmail: auth.email,
        },
      })
    } else if (kind === 'OUR_RESPONSE') {
      await tx.quotationEvent.create({
        data: {
          quotationId: id,
          type: 'RESPONSE',
          message: `Our Response: ${snippet}`,
          meta: { commentId: created.id, kind, mentionedHandles },
          actorEmail: auth.email,
        },
      })
    } else {
      await tx.quotationEvent.create({
        data: {
          quotationId: id,
          type: 'COMMENT',
          message: snippet,
          meta: {
            commentId: created.id,
            kind,
            attachmentCount: attachmentUrls.length,
            mentionedHandles,
          },
          actorEmail: auth.email,
        },
      })
    }
    return created
  })

  const attachNote = attachmentUrls.length
    ? ` (+${attachmentUrls.length} attachment${attachmentUrls.length > 1 ? 's' : ''})`
    : ''
  const discordLabel =
    kind === 'CUSTOMER_RESPONSE'
      ? 'Customer Replied'
      : kind === 'OUR_RESPONSE'
        ? 'Our Response'
        : `Comment from ${auth.email}`
  await notifyQuotationUpdate(
    quotation,
    `💬 ${discordLabel}${attachNote}:\n${discordBody.slice(0, 1800)}`,
  )

  return NextResponse.json(comment, { status: 201 })
}
