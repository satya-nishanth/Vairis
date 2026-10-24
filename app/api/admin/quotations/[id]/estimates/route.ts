import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { requireAdminApi } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyQuotationUpdate, quotationMilestone } from '@/lib/quotations'

export const dynamic = 'force-dynamic'

const snapshotSchema = z.object({
  /** Optional — estimate lives on the quotation; blank → "v{N}" label. */
  name: z.string().trim().max(120).optional().default(''),
  mode: z.enum(['standard', 'complex']),
  ratesLocked: z.boolean().default(false),
  standard: z.record(z.string(), z.unknown()).optional(),
  complex: z.record(z.string(), z.unknown()).optional(),
  results: z.object({
    finalTotal: z.number().finite().nonnegative(),
    totalBeforeGst: z.number().finite().optional(),
    goldCost: z.number().finite().optional(),
    diamondCost: z.number().finite().optional(),
    wastageCost: z.number().finite().optional(),
    makingCost: z.number().finite().optional(),
    additionalCost: z.number().finite().optional(),
  }),
  pngUrl: z.string().url().optional().nullable(),
})

/** GET — estimate history for a quotation (newest first). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  const { id } = await params
  const quotation = await prisma.quotation.findUnique({ where: { id }, select: { id: true } })
  if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })

  const estimates = await prisma.quotationEstimate.findMany({
    where: { quotationId: id },
    orderBy: { version: 'desc' },
  })
  return NextResponse.json(estimates)
}

/** POST — save a new estimate version (always appends; never overwrites). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi()
  if (auth.error) return auth.error

  const { id } = await params
  const parsed = snapshotSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const d = parsed.data
  if (d.results.finalTotal <= 0) {
    return NextResponse.json({ error: 'finalTotal must be greater than zero' }, { status: 400 })
  }

  const quotation = await prisma.quotation.findUnique({ where: { id } })
  if (!quotation) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
  if (quotation.status === 'CONVERTED' || quotation.status === 'CANCELLED') {
    return NextResponse.json({ error: `Cannot add estimate on ${quotation.status}` }, { status: 409 })
  }

  const goldRateRaw =
    d.mode === 'complex'
      ? (d.complex as { goldRate?: string } | undefined)?.goldRate
      : (d.standard as { goldRate?: string } | undefined)?.goldRate
  const goldRateNum = goldRateRaw != null ? Number(String(goldRateRaw).replace(/,/g, '')) : NaN
  const lockedGoldRate24k =
    d.ratesLocked && Number.isFinite(goldRateNum) ? new Prisma.Decimal(goldRateNum) : null

  const estimate = await prisma.$transaction(async (tx) => {
    const agg = await tx.quotationEstimate.aggregate({
      where: { quotationId: id },
      _max: { version: true },
    })
    const version = (agg._max.version ?? 0) + 1
    const name = d.name || `v${version}`
    const created = await tx.quotationEstimate.create({
      data: {
        quotationId: id,
        version,
        name,
        mode: d.mode,
        ratesLocked: d.ratesLocked,
        lockedGoldRate24k,
        payload: {
          name,
          mode: d.mode,
          standard: d.standard ?? {},
          complex: d.complex ?? {},
          results: d.results,
        } as Prisma.InputJsonValue,
        finalTotal: Math.round(d.results.finalTotal),
        pngUrl: d.pngUrl ?? null,
        createdByEmail: auth.email,
      },
    })
    await tx.quotationEvent.create({
      data: {
        quotationId: id,
        type: 'ESTIMATE',
        message: `Estimate v${version} · ₹${Math.round(d.results.finalTotal).toLocaleString('en-IN')}${d.ratesLocked ? ' (gold rate locked)' : ''}`,
        meta: { estimateId: created.id, version, ratesLocked: d.ratesLocked },
        actorEmail: auth.email,
      },
    })
    // Keep quotedAmount in sync with latest estimate when already QUOTED / ACCEPTED
    if (quotation.status === 'QUOTED' || quotation.status === 'ACCEPTED') {
      await tx.quotation.update({
        where: { id },
        data: { quotedAmount: Math.round(d.results.finalTotal) },
      })
    }
    return created
  })

  await notifyQuotationUpdate(
    quotation,
    quotationMilestone(
      'Estimate created',
      `v${estimate.version} · ₹${estimate.finalTotal.toLocaleString('en-IN')}${estimate.ratesLocked ? ' · gold rate locked' : ''}`,
    ),
  )

  return NextResponse.json(estimate, { status: 201 })
}
