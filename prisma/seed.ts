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

  const ring = await prisma.product.create({
    data: {
      name: 'Solitaire Ring',
      description: 'Timeless single-stone ring in 18k gold.',
      category: 'RINGS',
      images: [],
      basePrice: 15000,
      variants: {
        create: [
          { metalType: 'GOLD_18K', size: '6', weightGrams: 2.5, makingChargePerGram: 500, miscCharges: 45, stock: 3, sku: 'RING-G18K-6' },
          { metalType: 'GOLD_14K', size: '6', weightGrams: 2.1, makingChargePerGram: 400, miscCharges: 45, stock: 5, sku: 'RING-G14K-6' },
        ],
      },
    },
  })
  console.log('Seeded:', ring.name)
}

main().catch(console.error).finally(() => prisma.$disconnect())
