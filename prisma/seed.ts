import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.goldRate.createMany({
    data: [
      { metalType: 'GOLD_18K', ratePerGram: 5100 },
      { metalType: 'GOLD_14K', ratePerGram: 3967 },
    ],
    skipDuplicates: true,
  })

  // Pricing v2 seeds (idempotent) — VA settings + per-carat diamond rates
  await prisma.pricingSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, vaGoldPct: 10, vaStonePct: 0, vaLabel: 'Wastage' },
  })
  const colorless = await prisma.diamondRate.upsert({
    where: { code: 'COLORLESS' },
    update: {},
    create: { code: 'COLORLESS', label: 'Colourless Diamond', ratePerCarat: 21000, ratePerCaratExchange: 30000, sortOrder: 0 },
  })
  await prisma.diamondRate.upsert({
    where: { code: 'SPECIAL_COLORED' },
    update: {},
    create: { code: 'SPECIAL_COLORED', label: 'Special Coloured Diamond', ratePerCarat: 31500, ratePerCaratExchange: 45000, sortOrder: 1 },
  })

  const ring = await prisma.product.create({
    data: {
      name: 'Solitaire Ring',
      description: 'Timeless single-stone ring in 18k gold.',
      category: 'RINGS',
      images: [],
      basePrice: 15000,
      status: 'LIVE',
      stones: {
        create: [
          { diamondRateId: colorless.id, caratWeight: 0.5, count: 1, label: 'Centre stone', sortOrder: 0 },
        ],
      },
      variants: {
        create: [
          { metalType: 'GOLD_18K', size: '6', weightGrams: 2.5, makingChargePerGram: 500, miscCharges: 45, stock: 3, sku: 'RING-G18K-6' },
          { metalType: 'GOLD_18K', size: '8', weightGrams: 2.8, makingChargePerGram: 500, miscCharges: 45, stock: 3, sku: 'RING-G18K-8' },
          { metalType: 'GOLD_14K', size: '6', weightGrams: 2.1, makingChargePerGram: 400, miscCharges: 45, stock: 5, sku: 'RING-G14K-6' },
        ],
      },
    },
  })
  console.log('Seeded:', ring.name)
}

main().catch(console.error).finally(() => prisma.$disconnect())
