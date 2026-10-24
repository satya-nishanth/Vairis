import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { QuotationStatus } from '@prisma/client'
import { requireAdminApi } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  QUOTATION_TRANSITIONS,
  closeThread,
  notifyQuotationUpdate,
  quotationMilestone,
} from '@/lib/quotations'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  const { id } = await params
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      estimates: { orderBy: { version: 'desc' } },
      events: { orderBy: { createdAt: 'desc' }, take: 100 },
      comments: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
  return NextResponse.json(quotation)
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('mark_quoted'),
    quotedAmount: z.number().int().positive().optional(),
    quotedNotes: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal('cancel'),
  }),
  z.object({
    action: z.literal('record_response'),
    response: z.enum(['accepted', 'declined', 'needs_revision']),
    channel: z.enum(['call', 'whatsapp', 'in_person', 'other']),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal('set_assignee'),
    assigneeEmail: z.string().trim().email().nullable(),
  }),
  z.object({
    action: z.literal('set_product'),
    productId: z.string().trim().min(1).nullable(),
  }),
  z.object({
    action: z.literal('update_details'),
    details: z.string().trim().min(1).max(2000).optional(),
    customerName: z.string().trim().max(100).nullable().optional(),
    customerMobile: z
      .union([z.string().trim().regex(/^\d{7,15}$/), z.literal(''), z.null()])
      .optional(),
    metalType: z.enum(['GOLD_9K', 'GOLD_14K', 'GOLD_18K', 'GOLD_22K']).nullable().optional(),
    metalColor: z.enum(['YELLOW', 'WHITE', 'ROSE']).nullable().optional(),
  }),
])

/** PATCH /api/admin/quotations/[id] — desk lifecycle actions. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const body = parsed.data

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { estimates: { orderBy: { version: 'desc' }, take: 1 } },
  })
  if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })

  if (body.action === 'set_assignee') {
    const updated = await prisma.quotation.update({
      where: { id },
      data: { assigneeEmail: body.assigneeEmail },
    })
    await prisma.quotationEvent.create({
      data: {
        quotationId: id,
        type: 'NOTE',
        message: body.assigneeEmail ? `Assignee set to ${body.assigneeEmail}` : 'Assignee cleared',
        actorEmail: auth.email,
      },
    })
    await notifyQuotationUpdate(
      updated,
      body.assigneeEmail ? `👤 Assigned to ${body.assigneeEmail}` : '👤 Assignee cleared',
    )
    return NextResponse.json(updated)
  }

  if (body.action === 'update_details') {
    if (quotation.status === 'CONVERTED' || quotation.status === 'CANCELLED') {
      return NextResponse.json({ error: `Cannot edit ${quotation.status} quotation` }, { status: 409 })
    }
    const data: {
      details?: string
      customerName?: string | null
      customerMobile?: string | null
      metalType?: 'GOLD_9K' | 'GOLD_14K' | 'GOLD_18K' | 'GOLD_22K' | null
      metalColor?: 'YELLOW' | 'WHITE' | 'ROSE' | null
    } = {}
    if (body.details !== undefined) data.details = body.details
    if (body.customerName !== undefined) data.customerName = body.customerName || null
    if (body.customerMobile !== undefined) {
      data.customerMobile = body.customerMobile === '' || body.customerMobile == null ? null : body.customerMobile
    }
    if (body.metalType !== undefined) data.metalType = body.metalType
    if (body.metalColor !== undefined) data.metalColor = body.metalColor
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    const updated = await prisma.quotation.update({ where: { id }, data })
    await prisma.quotationEvent.create({
      data: {
        quotationId: id,
        type: 'NOTE',
        message: 'Requirements / customer details updated',
        meta: data,
        actorEmail: auth.email,
      },
    })
    await notifyQuotationUpdate(updated, '📝 Requirements / customer details updated')
    return NextResponse.json(updated)
  }

  if (body.action === 'set_product') {
    let productLabel = 'none'
    if (body.productId) {
      const product = await prisma.product.findUnique({
        where: { id: body.productId },
        select: { id: true, name: true, itemCode: true },
      })
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      productLabel = product.itemCode ? `${product.name} (${product.itemCode})` : product.name
    }
    const updated = await prisma.quotation.update({
      where: { id },
      data: { productId: body.productId },
    })
    await prisma.quotationEvent.create({
      data: {
        quotationId: id,
        type: 'NOTE',
        message: body.productId ? `Catalogue product set: ${productLabel}` : 'Catalogue product cleared',
        meta: { productId: body.productId },
        actorEmail: auth.email,
      },
    })
    await notifyQuotationUpdate(
      updated,
      body.productId ? `🔗 Product linked: **${productLabel}**` : '🔗 Product cleared',
    )
    return NextResponse.json(updated)
  }

  if (body.action === 'record_response') {
    if (quotation.status !== 'QUOTED' && quotation.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: `Cannot record response from ${quotation.status}` },
        { status: 409 },
      )
    }

    let nextStatus: QuotationStatus = quotation.status
    if (body.response === 'accepted') nextStatus = 'ACCEPTED'
    else if (body.response === 'declined') nextStatus = 'CANCELLED'
    // needs_revision stays QUOTED (or falls back to QUOTED from ACCEPTED)

    if (body.response === 'needs_revision') {
      nextStatus = 'QUOTED'
    }

    if (nextStatus !== quotation.status) {
      const allowed = QUOTATION_TRANSITIONS[quotation.status] ?? []
      if (!allowed.includes(nextStatus)) {
        return NextResponse.json(
          { error: `Cannot move ${quotation.status} → ${nextStatus}` },
          { status: 409 },
        )
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.quotation.update({
        where: { id },
        data: {
          status: nextStatus,
          acceptedAt:
            nextStatus === 'ACCEPTED'
              ? new Date()
              : nextStatus === 'QUOTED'
                ? null
                : quotation.acceptedAt,
        },
      })
      await tx.quotationEvent.create({
        data: {
          quotationId: id,
          type: 'RESPONSE',
          message: `Customer ${body.response} via ${body.channel}${body.notes ? `: ${body.notes}` : ''}`,
          meta: { response: body.response, channel: body.channel, notes: body.notes ?? null },
          actorEmail: auth.email,
        },
      })
      if (nextStatus !== quotation.status) {
        await tx.quotationEvent.create({
          data: {
            quotationId: id,
            type: 'STATUS',
            message: `${quotation.status} → ${nextStatus}`,
            meta: { from: quotation.status, to: nextStatus },
            actorEmail: auth.email,
          },
        })
      }
      return row
    })

    if (nextStatus === 'CANCELLED' && updated.discordThreadId) {
      try {
        await closeThread(updated.discordThreadId, '❌ Declined / cancelled (via dashboard).')
      } catch (err) {
        console.error('[api/admin/quotations/[id]] Discord close failed', err)
      }
    } else {
      const title =
        body.response === 'accepted'
          ? 'Accepted'
          : body.response === 'needs_revision'
            ? 'Needs revision'
            : 'Response recorded'
      await notifyQuotationUpdate(
        updated,
        quotationMilestone(
          title,
          `via ${body.channel}${body.notes ? ` · ${body.notes}` : ''}${nextStatus !== quotation.status ? ` · ${quotation.status} → ${nextStatus}` : ''}`,
        ),
      )
    }

    return NextResponse.json(updated)
  }

  const nextStatus: QuotationStatus = body.action === 'mark_quoted' ? 'QUOTED' : 'CANCELLED'
  const allowed = QUOTATION_TRANSITIONS[quotation.status] ?? []
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json({ error: `Cannot move ${quotation.status} → ${nextStatus}` }, { status: 409 })
  }

  const latestEstimate = quotation.estimates[0]
  const quotedAmount =
    body.action === 'mark_quoted'
      ? (body.quotedAmount ?? latestEstimate?.finalTotal ?? undefined)
      : undefined
  const quotedNotes = body.action === 'mark_quoted' ? body.quotedNotes : undefined

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.quotation.update({
      where: { id },
      data:
        nextStatus === 'QUOTED'
          ? { status: 'QUOTED', quotedAt: new Date(), quotedAmount, quotedNotes }
          : { status: 'CANCELLED' },
    })
    await tx.quotationEvent.create({
      data: {
        quotationId: id,
        type: 'STATUS',
        message:
          nextStatus === 'QUOTED'
            ? `Marked QUOTED${quotedAmount != null ? ` · ₹${quotedAmount.toLocaleString('en-IN')}` : ''}`
            : 'Cancelled',
        meta: { from: quotation.status, to: nextStatus, quotedAmount: quotedAmount ?? null },
        actorEmail: auth.email,
      },
    })
    return row
  })

  if (nextStatus === 'CANCELLED' && updated.discordThreadId) {
    try {
      await closeThread(updated.discordThreadId, '❌ Cancelled (via dashboard).')
    } catch (err) {
      console.error('[api/admin/quotations/[id]] Discord close failed', err)
    }
  } else if (nextStatus === 'QUOTED') {
    await notifyQuotationUpdate(
      updated,
      quotationMilestone(
        'Estimate sent',
        `Status → QUOTED${quotedAmount != null ? ` · ₹${quotedAmount.toLocaleString('en-IN')}` : ''}${quotedNotes ? ` · ${quotedNotes}` : ''}`,
      ),
    )
  }

  return NextResponse.json(updated)
}
