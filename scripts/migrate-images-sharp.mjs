/**
 * Migrate existing product images through Sharp + interactive reorder.
 *
 * For each product:
 *   1. Shows current image URLs (open in browser to identify front/left/right/back)
 *   2. Asks for new order (e.g. "2,0,3,1") — press Enter to keep current
 *   3. Re-processes each image through Sharp (1200px JPEG 85%)
 *   4. Uploads resized files, deletes old files, updates DB
 *
 * Run:
 *   export $(grep -v '^#' .env.prod | xargs) && node scripts/migrate-images-sharp.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'
import * as readline from 'readline'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'product-media'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const prisma = new PrismaClient()
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((resolve) => rl.question(q, resolve))

const SLOT_NAMES = ['Front', 'Left', 'Right', 'Back', 'Video']

function isVideo(url) {
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url)
}

function extractStoragePath(url) {
  const marker = `/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

async function processImage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()

  const resized = await sharp(Buffer.from(arrayBuffer))
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  const newPath = `products/images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(newPath, resized, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(newPath)

  const oldPath = extractStoragePath(url)
  if (oldPath) {
    const { error: deleteError } = await supabase.storage.from(BUCKET).remove([oldPath])
    if (deleteError) console.warn(`  Could not delete old file ${oldPath}: ${deleteError.message}`)
  }

  return data.publicUrl
}

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, images: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`\nFound ${products.length} products`)
  console.log('For each product: open image URLs in browser, then type the new order.\n')
  console.log('Slot positions: 0=Front  1=Left  2=Right  3=Back  4=Video\n')
  console.log('─'.repeat(60))

  for (const product of products) {
    console.log(`\nProduct: ${product.name}`)

    const images = product.images.filter(Boolean)
    if (images.length === 0) {
      console.log('  No images — skipping')
      continue
    }

    // Show current images
    images.forEach((url, i) => {
      const type = isVideo(url) ? 'video' : 'image'
      console.log(`  [${i}] (${type}) ${url}`)
    })

    // Ask for reorder
    const input = await ask(
      `\n  New order for Front/Left/Right/Back/Video (e.g. "2,0,3,1") or Enter to keep: `
    )

    let orderedImages = [...images]

    if (input.trim()) {
      const indices = input.trim().split(',').map((s) => parseInt(s.trim(), 10))
      const valid = indices.every((i) => !isNaN(i) && i >= 0 && i < images.length)
      if (!valid) {
        console.log('  Invalid order — keeping current order')
      } else {
        orderedImages = indices.map((i) => images[i])
        console.log(`  Reordered: ${indices.map((i) => `[${i}]`).join(' → ')}`)
      }
    }

    // Process each image through Sharp
    console.log('  Processing images...')
    const newImages = []
    for (let i = 0; i < orderedImages.length; i++) {
      const url = orderedImages[i]
      const slotName = SLOT_NAMES[i] ?? `Slot ${i}`
      if (isVideo(url)) {
        console.log(`    ${slotName}: video — skipping Sharp`)
        newImages.push(url)
        continue
      }
      try {
        process.stdout.write(`    ${slotName}: resizing...`)
        const newUrl = await processImage(url)
        newImages.push(newUrl)
        console.log(' ✓')
      } catch (err) {
        console.log(` FAILED: ${err.message} — keeping original`)
        newImages.push(url)
      }
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { images: newImages },
    })
    console.log(`  DB updated ✓`)
    console.log('─'.repeat(60))
  }

  console.log('\nMigration complete.')
  rl.close()
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  rl.close()
  prisma.$disconnect()
  process.exit(1)
})
