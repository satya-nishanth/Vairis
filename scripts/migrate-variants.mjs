/**
 * Migrate all product variants to CAD-verified 14K and 18K gold only.
 * Only karats present in the CAD are created — no interpolation.
 * Silver 925, 22K removed.
 *
 * Run:
 *   export $(grep -v '^#' .env.prod | xargs) && DATABASE_URL="${DATABASE_URL}?pgbouncer=true&connection_limit=1" node scripts/migrate-variants.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// CAD-verified weights. Only karats present in CAD listed.
// Filtered to 14K and 18K (no CAD has 16K — don't add what isn't there).
const CATALOGUE = [
  // ── BRACELETS ──────────────────────────────────────────────────────────────
  { itemCode: 'AJBR-74', size: null, makeCharge: 500, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 8.500 }, { karat: 'GOLD_14K', weight: 7.225 }] },

  // ── EARRINGS ───────────────────────────────────────────────────────────────
  { itemCode: 'AJER-398', size: null, makeCharge: 500, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 14.500 }, { karat: 'GOLD_14K', weight: 12.325 }] },
  { itemCode: 'AJER-319', size: null, makeCharge: 450, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 4.800 }, { karat: 'GOLD_14K', weight: 4.080 }] },
  { itemCode: 'AJER-310', size: null, makeCharge: 400, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 2.000 }, { karat: 'GOLD_14K', weight: 1.700 }] },
  { itemCode: 'AJER-318', size: null, makeCharge: 500, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 3.000 }, { karat: 'GOLD_14K', weight: 2.550 }] },
  { itemCode: 'AJER-335', size: null, makeCharge: 500, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 4.700 }, { karat: 'GOLD_14K', weight: 3.995 }] },
  { itemCode: 'AJER-312', size: null, makeCharge: 450, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 4.400 }, { karat: 'GOLD_14K', weight: 3.740 }] },
  { itemCode: 'AJPS-55-ER', size: null, makeCharge: 400, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 2.000 }, { karat: 'GOLD_14K', weight: 1.700 }] },

  // ── PENDANTS ───────────────────────────────────────────────────────────────
  { itemCode: 'AJPD-195', size: null, makeCharge: 400, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 1.500 }, { karat: 'GOLD_14K', weight: 1.275 }] },
  { itemCode: 'AJPD-197', size: null, makeCharge: 400, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 1.700 }, { karat: 'GOLD_14K', weight: 1.445 }] },
  { itemCode: 'AJPD-200', size: null, makeCharge: 400, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 3.000 }, { karat: 'GOLD_14K', weight: 2.550 }] },
  { itemCode: 'AJPD-170', size: null, makeCharge: 400, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 1.500 }, { karat: 'GOLD_14K', weight: 1.275 }] },
  { itemCode: 'AJPD-171', size: null, makeCharge: 400, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 0.900 }, { karat: 'GOLD_14K', weight: 0.765 }] },

  // ── RINGS ──────────────────────────────────────────────────────────────────
  { itemCode: 'AJLR-637', size: '15', makeCharge: 450, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 3.100 }, { karat: 'GOLD_14K', weight: 2.635 }] },
  { itemCode: 'AJLR-636', size: '15', makeCharge: 400, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 3.100 }, { karat: 'GOLD_14K', weight: 2.635 }] },
  { itemCode: 'AJLR-638', size: '15', makeCharge: 450, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 2.300 }, { karat: 'GOLD_14K', weight: 1.955 }] },
  { itemCode: 'AJLR-596', size: '12', makeCharge: 450, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 3.700 }, { karat: 'GOLD_14K', weight: 3.145 }] },
  { itemCode: 'AJLR-587', size: '16', makeCharge: 500, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 3.400 }, { karat: 'GOLD_14K', weight: 2.890 }] },
  { itemCode: 'AJLR-599', size: '14', makeCharge: 400, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 4.800 }, { karat: 'GOLD_14K', weight: 4.080 }] },
  { itemCode: 'AJLR-601', size: '14', makeCharge: 500, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 4.900 }, { karat: 'GOLD_14K', weight: 4.165 }] },
  { itemCode: 'AJLR-663', size: '20', makeCharge: 450, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 3.900 }, { karat: 'GOLD_14K', weight: 3.315 }] },
  { itemCode: 'AJLR-593', size: '12', makeCharge: 350, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 2.600 }, { karat: 'GOLD_14K', weight: 2.210 }] },
  { itemCode: 'AJLR-598', size: '12', makeCharge: 500, misc: 45,
    variants: [{ karat: 'GOLD_18K', weight: 2.200 }, { karat: 'GOLD_14K', weight: 1.870 }] },
]

// Emerald Diamond Bangle — no itemCode, match by name
const BANGLE = {
  name: 'Emerald Diamond Bangle', size: null, makeCharge: 600, misc: 45,
  variants: [{ karat: 'GOLD_18K', weight: 32.41 }, { karat: 'GOLD_14K', weight: 27.70 }],
}

const SKU_SUFFIX = { GOLD_18K: 'G18K', GOLD_14K: 'G14K' }

async function upsertVariants(productId, itemCodeBase, entry) {
  for (const v of entry.variants) {
    const suffix = SKU_SUFFIX[v.karat]
    const sku = entry.size
      ? `${itemCodeBase}-${suffix}-${entry.size}`
      : `${itemCodeBase}-${suffix}`

    await prisma.productVariant.create({
      data: {
        productId,
        metalType: v.karat,
        weightGrams: v.weight,
        makingChargePerGram: entry.makeCharge,
        flatMakingCharge: 0,
        stoneCharges: 0,
        miscCharges: entry.misc,
        stock: 0,
        size: entry.size,
        sku,
      },
    })
  }
}

async function main() {
  console.log('Step 1: Deleting all existing variants...')
  const deleted = await prisma.productVariant.deleteMany({})
  console.log(`  Deleted ${deleted.count} variants\n`)

  console.log('Step 2: Creating 18K + 14K variants from CAD data...')
  let created = 0
  let failed = 0

  for (const entry of CATALOGUE) {
    const product = await prisma.product.findUnique({ where: { itemCode: entry.itemCode } })
    if (!product) {
      console.log(`  SKIP ${entry.itemCode} — not in DB`)
      failed++
      continue
    }
    await upsertVariants(product.id, entry.itemCode, entry)
    const varStr = entry.variants.map(v => `${v.karat.replace('GOLD_', '')}:${v.weight}g`).join(' · ')
    console.log(`  ✓ ${entry.itemCode} — ${varStr}`)
    created++
  }

  // Bangle by name
  const bangle = await prisma.product.findFirst({ where: { name: BANGLE.name } })
  if (bangle) {
    await upsertVariants(bangle.id, 'EMERALD-BANGLE', BANGLE)
    console.log(`  ✓ Emerald Diamond Bangle — 18K:${BANGLE.variants[0].weight}g · 14K:${BANGLE.variants[1].weight}g`)
    created++
  } else {
    console.log(`  SKIP Emerald Diamond Bangle — not in DB`)
    failed++
  }

  const total = created * 2
  console.log(`\nDone — Products: ${created} updated | ${failed} skipped`)
  console.log(`Variants created: ${total} (2 per product: 18K + 14K)`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
