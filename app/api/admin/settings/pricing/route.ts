import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const pct = z
  .union([z.string(), z.number()])
  .transform(Number)
  .refine((n) => !Number.isNaN(n) && n >= 0 && n <= 100, 'Percentage must be 0–100')

const rateValue = z
  .union([z.string(), z.number()])
  .transform(Number)
  .refine((n) => !Number.isNaN(n) && n >= 0, 'Rate cannot be negative')

const inrFixed = z
  .union([z.string(), z.number()])
  .transform(Number)
  .refine((n) => !Number.isNaN(n) && n >= 0, 'Amount cannot be negative')

const feeLabel = z.string().trim().min(1, 'Label is required').max(40)

const putSchema = z.object({
  vaGoldPct: pct,
  vaStonePct: pct,
  vaLabel: z.string().trim().min(1, 'Label is required').max(40),
  defaultCertificationCharges: inrFixed.optional(),
  defaultPackagingCharges: inrFixed.optional(),
  defaultDeliveryCharges: inrFixed.optional(),
  certificationLabel: feeLabel.optional(),
  packagingLabel: feeLabel.optional(),
  deliveryLabel: feeLabel.optional(),
  showPricesGlobal: z.boolean(),
  diamondRates: z.array(
    z.object({
      id: z.string().optional(), // absent = create
      code: z
        .string()
        .trim()
        .min(1, 'Code is required')
        .max(40)
        .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '_')),
      label: z.string().trim().min(1, 'Label is required').max(60),
      ratePerCarat: rateValue,
      ratePerCaratExchange: rateValue,
      active: z.boolean().default(true),
    }),
  ),
})

export async function GET() {
  await requireAdmin()
  const [settings, diamondRates] = await Promise.all([
    prisma.pricingSettings.findUnique({ where: { id: 1 } }),
    prisma.diamondRate.findMany({ orderBy: { sortOrder: 'asc' } }),
  ])
  return NextResponse.json({
    vaGoldPct: Number(settings?.vaGoldPct ?? 10),
    vaStonePct: Number(settings?.vaStonePct ?? 0),
    vaLabel: settings?.vaLabel ?? 'Value Addition',
    defaultCertificationCharges: Number(settings?.defaultCertificationCharges ?? 0),
    defaultPackagingCharges: Number(settings?.defaultPackagingCharges ?? 0),
    defaultDeliveryCharges: Number(settings?.defaultDeliveryCharges ?? 0),
    certificationLabel: settings?.certificationLabel ?? 'Certification',
    packagingLabel: settings?.packagingLabel ?? 'Packaging',
    deliveryLabel: settings?.deliveryLabel ?? 'Delivery',
    showPricesGlobal: settings?.showPricesGlobal ?? true,
    diamondRates: diamondRates.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      ratePerCarat: Number(r.ratePerCarat),
      ratePerCaratExchange: Number(r.ratePerCaratExchange),
      active: r.active,
    })),
  })
}

export async function PUT(req: NextRequest) {
  await requireAdmin()
  const parsed = putSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 },
    )
  }
  const data = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      const fields = {
        vaGoldPct: data.vaGoldPct,
        vaStonePct: data.vaStonePct,
        vaLabel: data.vaLabel,
        defaultCertificationCharges: data.defaultCertificationCharges ?? 0,
        defaultPackagingCharges: data.defaultPackagingCharges ?? 0,
        defaultDeliveryCharges: data.defaultDeliveryCharges ?? 0,
        certificationLabel: data.certificationLabel ?? 'Certification',
        packagingLabel: data.packagingLabel ?? 'Packaging',
        deliveryLabel: data.deliveryLabel ?? 'Delivery',
        showPricesGlobal: data.showPricesGlobal,
      }
      await tx.pricingSettings.upsert({
        where: { id: 1 },
        update: fields,
        create: { id: 1, ...fields },
      })

      const existing = await tx.diamondRate.findMany()
      const keptIds = new Set<string>()

      for (const [i, r] of data.diamondRates.entries()) {
        const fields = {
          code: r.code,
          label: r.label,
          ratePerCarat: r.ratePerCarat,
          ratePerCaratExchange: r.ratePerCaratExchange,
          active: r.active,
          sortOrder: i,
        }
        if (r.id) {
          await tx.diamondRate.update({ where: { id: r.id }, data: fields })
          keptIds.add(r.id)
        } else {
          const created = await tx.diamondRate.create({ data: fields })
          keptIds.add(created.id)
        }
      }

      // Removed rates: delete if unreferenced, otherwise deactivate so
      // existing product stones keep pricing correctly.
      for (const r of existing) {
        if (keptIds.has(r.id)) continue
        const refs = await tx.productStone.count({ where: { diamondRateId: r.id } })
        if (refs === 0) await tx.diamondRate.delete({ where: { id: r.id } })
        else await tx.diamondRate.update({ where: { id: r.id }, data: { active: false } })
      }
    })
  } catch (err) {
    console.error('[admin/settings/pricing PUT]', err)
    return NextResponse.json(
      { error: 'Save failed — check for duplicate diamond type codes' },
      { status: 409 },
    )
  }

  return GET()
}
