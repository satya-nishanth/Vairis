/**
 * Migrate existing product images through Sharp.
 * Downloads each image from Supabase, resizes to max 1200px JPEG 85%,
 * re-uploads, deletes the old file, and updates the DB record.
 *
 * Run with prod credentials:
 *   NODE_ENV=production npx dotenv -e .env.prod -- node scripts/migrate-images-sharp.mjs
 *
 * Or export vars manually:
 *   export $(cat .env.prod | grep -v '^#' | xargs) && node scripts/migrate-images-sharp.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'product-media'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const prisma = new PrismaClient()

function isVideo(url) {
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url)
}

function extractStoragePath(url) {
  // URL: https://xxx.supabase.co/storage/v1/object/public/product-media/products/images/file.jpg
  // Path: products/images/file.jpg
  const marker = `/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

async function processImage(url) {
  // Download
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()

  // Sharp resize
  const resized = await sharp(Buffer.from(arrayBuffer))
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  // Upload new file
  const newPath = `products/images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(newPath, resized, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  // Get new public URL
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(newPath)

  // Delete old file
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
  })

  console.log(`Found ${products.length} products\n`)

  for (const product of products) {
    console.log(`Processing: ${product.name} (${product.id})`)
    const newImages = []

    for (let i = 0; i < product.images.length; i++) {
      const url = product.images[i]
      if (!url) {
        newImages.push(url)
        continue
      }
      if (isVideo(url)) {
        console.log(`  [${i}] video — skipping`)
        newImages.push(url)
        continue
      }
      try {
        process.stdout.write(`  [${i}] image — processing...`)
        const newUrl = await processImage(url)
        newImages.push(newUrl)
        console.log(' done')
      } catch (err) {
        console.log(` FAILED: ${err.message}`)
        newImages.push(url) // keep original on failure
      }
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { images: newImages },
    })
    console.log(`  DB updated\n`)
  }

  console.log('Migration complete.')
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
