import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { QuotationStatus } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  createWithUniqueDisplayId,
  createQuoteThread,
  mentionAssignee,
  quotationMilestone,
  notifyQuotationUpdate,
} from '@/lib/quotations'

export const dynamic = 'force-dynamic'

const manualQuotationSchema = z.object({
  orderType: z.enum(['VAIRIS', 'CUSTOMISATION']),
  details: z.string().trim().min(1).max(2000),
  customerName: z.string().trim().max(100).optional(),
  customerMobile: z.string().trim().regex(/^\d{7,15}$/).optional().or(z.literal('')),
  metalType: z.enum(['GOLD_9K', 'GOLD_14K', 'GOLD_18K', 'GOLD_22K']).nullable().optional(),
  metalColor: z.enum(['YELLOW', 'WHITE', 'ROSE']).nullable().optional(),
  productId: z.string().trim().optional(),
  screenshotUrls: z.array(z.string().url()).max(6).optional(),
})

/** POST /api/admin/quotations — manual/dashboard intake. orderType is required, no default. */
export async function POST(req: NextRequest) {
  await requireAdmin()

  const parsed = manualQuotationSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const d = parsed.data

  const quotation = await createWithUniqueDisplayId(
    { customerName: d.customerName, customerMobile: d.customerMobile, sku: d.productId },
    (displayId) =>
      prisma.quotation.create({
        data: {
          displayId,
          source: 'MANUAL',
          orderType: d.orderType,
          details: d.details,
          customerName: d.customerName || null,
          customerMobile: d.customerMobile || null,
          metalType: d.metalType ?? null,
          metalColor: d.metalColor ?? null,
          productId: d.productId || null,
          screenshotUrls: d.screenshotUrls ?? [],
        },
      }),
  )

  await prisma.quotationEvent.create({
    data: {
      quotationId: quotation.id,
      type: 'CREATED',
      message: `Created (${d.orderType})`,
      meta: { source: 'MANUAL' },
    },
  })

  try {
    const threadId = await createQuoteThread(
      `${quotation.displayId} · ${d.orderType.toLowerCase()} · ${d.details.slice(0, 60)}`,
    )
    const withThread = await prisma.quotation.update({
      where: { id: quotation.id },
      data: { discordThreadId: threadId },
    })
    await notifyQuotationUpdate(
      withThread,
      `${mentionAssignee()} ${quotationMilestone(
        'Quotation created',
        `${d.orderType}\n**Details:** ${d.details}${d.customerName ? `\n**Customer:** ${d.customerName}` : ''}${d.customerMobile ? `\n**Mobile:** ${d.customerMobile}` : ''}`,
      )}`,
    )
  } catch (err) {
    // Never blocks the response — ensureQuoteThread on later notifies will retry.
    console.error('[api/admin/quotations] Discord thread creation failed', err)
  }

  return NextResponse.json({ id: quotation.id, displayId: quotation.displayId }, { status: 201 })
}

/** GET /api/admin/quotations?status=&attention=true — dashboard list. */
export async function GET(req: NextRequest) {
  await requireAdmin()

  const status = req.nextUrl.searchParams.get('status') as QuotationStatus | null
  const attention = req.nextUrl.searchParams.get('attention') === 'true'
  const staleHours = Number(process.env.QUOTE_STALE_QUOTED_HOURS ?? 24)
  const staleThreshold = new Date(Date.now() - staleHours * 60 * 60 * 1000)

  const where = attention
    ? {
        OR: [
          { status: 'REQUESTED' as const, escalatedAt: { not: null } },
          { status: 'QUOTED' as const, quotedAt: { lt: staleThreshold } },
        ],
      }
    : status
      ? { status }
      : undefined

  const quotations = await prisma.quotation.findMany({
    where,
    orderBy: status === 'QUOTED' ? { quotedAt: 'asc' } : { createdAt: 'asc' },
    take: 200,
  })
  return NextResponse.json(quotations)
}
