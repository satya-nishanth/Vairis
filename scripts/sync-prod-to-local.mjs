/**
 * Sync catalogue data from production → local Supabase/Postgres.
 *
 * Uses the public prod API (no DB password needed).
 * Images stay on prod storage by default (works locally via next.config remotePatterns).
 * Pass --mirror-media to copy files into local Supabase Storage.
 *
 * Run:
 *   node scripts/sync-prod-to-local.mjs
 *   node scripts/sync-prod-to-local.mjs --mirror-media
 *
 * Requires: supabase start, .env.local with local DATABASE_URL + SUPABASE keys
 */

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const PROD_APP_URL = process.env.PROD_APP_URL ?? 'https://vairis-ten.vercel.app'
const LOCAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const LOCAL_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'product-media'
const MIRROR_MEDIA = process.argv.includes('--mirror-media')

const prisma = new PrismaClient()
const supabase = LOCAL_SERVICE_KEY
  ? createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY)
  : null

function log(msg) {
  console.log(`[sync] ${msg}`)
}

async function fetchJson(path) {
  const res = await fetch(`${PROD_APP_URL}${path}`)
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

async function ensureBucket() {
  if (!supabase) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing in env')
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
  if (error && !error.message.toLowerCase().includes('already exist')) throw error
}

async function mirrorUrl(url) {
  if (!supabase) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing for --mirror-media')
  const parsed = new URL(url)
  const storagePath = parsed.pathname.split(`/storage/v1/object/public/${BUCKET}/`)[1]
  if (!storagePath) return url

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${url} → ${res.status}`)
  const data = await res.arrayBuffer()
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, data, {
    contentType,
    upsert: true,
  })
  if (error) throw new Error(`Upload failed ${storagePath}: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return publicUrl
}

async function clearLocalCatalogue() {
  const dbUrl = process.env.DATABASE_URL ?? ''
  if (dbUrl.includes('pooler.supabase.com') && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    throw new Error(`Refusing to clear — DATABASE_URL looks like production (${dbUrl.split('@')[1] ?? dbUrl}). Set DATABASE_URL to local DB first.`)
  }
  log('Clearing local catalogue tables…')
  await prisma.wishlist.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.shipment.deleteMany()
  await prisma.order.deleteMany()
  await prisma.address.deleteMany()
  await prisma.productVariant.deleteMany()
  await prisma.product.deleteMany()
}

async function syncGoldRates() {
  const data = await fetchJson('/api/gold-rates')
  const rates = data.rates
  if (!rates) throw new Error('Prod gold rates unavailable')

  await prisma.goldRate.upsert({
    where: { metalType: 'GOLD_18K' },
    create: { metalType: 'GOLD_18K', ratePerGram: rates['18K'] },
    update: { ratePerGram: rates['18K'] },
  })
  await prisma.goldRate.upsert({
    where: { metalType: 'GOLD_14K' },
    create: { metalType: 'GOLD_14K', ratePerGram: rates['14K'] },
    update: { ratePerGram: rates['14K'] },
  })
  log(`Gold rates: 18K ₹${rates['18K']}/g, 14K ₹${rates['14K']}/g`)
}

async function syncProducts() {
  const products = await fetchJson('/api/products')
  log(`Fetched ${products.length} products from ${PROD_APP_URL}`)

  if (MIRROR_MEDIA) {
    await ensureBucket()
    log('Mirroring media to local storage (this may take a few minutes)…')
  }

  let created = 0
  for (const p of products) {
    let images = p.images ?? []
    if (MIRROR_MEDIA && images.length) {
      images = []
      for (const url of p.images) {
        images.push(await mirrorUrl(url))
        log(`  mirrored ${url.split('/').pop()}`)
      }
    }

    await prisma.product.create({
      data: {
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        images,
        basePrice: p.basePrice ?? 0,
        isActive: p.isActive ?? true,
        createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        itemCode: p.itemCode,
        designStyle: p.designStyle,
        totalLengthMm: p.totalLengthMm,
        motifSizeMm: p.motifSizeMm,
        thicknessMm: p.thicknessMm,
        stoneType: p.stoneType,
        stoneShape: p.stoneShape,
        stoneDimMm: p.stoneDimMm,
        gemCount: p.gemCount,
        caratWeight: p.caratWeight,
        comingSoon: p.comingSoon ?? false,
        variants: {
          create: (p.variants ?? []).map((v) => ({
            id: v.id,
            metalType: v.metalType,
            size: v.size ?? null,
            weightGrams: v.weightGrams,
            makingChargePerGram: v.makingChargePerGram ?? 400,
            flatMakingCharge: v.flatMakingCharge ?? 0,
            stoneCharges: v.stoneCharges ?? 0,
            miscCharges: v.miscCharges ?? 45,
            stock: v.stock ?? 0,
            sku: v.sku,
          })),
        },
      },
    })
    created++
    log(`✓ ${p.name} (${images.length} media, ${p.variants?.length ?? 0} variants)`)
  }

  return created
}

async function main() {
  log(`Source: ${PROD_APP_URL}`)
  log(`Target DB: ${process.env.DATABASE_URL ?? '(from .env)'}`)
  if (MIRROR_MEDIA) log('Mode: mirror media to local storage')
  else log('Mode: keep prod image URLs (fast — images load from prod CDN)')

  await clearLocalCatalogue()
  await syncGoldRates()
  const count = await syncProducts()

  log(`Done — ${count} products synced`)
}

main()
  .catch((e) => {
    console.error('[sync] Failed:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
