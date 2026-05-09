/**
 * Re-upload all product images from the local catalogue through Sharp.
 * Enforces correct order: front → left → right → back → video.
 * Deletes old Supabase files and updates DB with new URLs.
 *
 * Run:
 *   export $(grep -v '^#' .env.prod | xargs) && node scripts/migrate-images-sharp.mjs
 */

import { readFileSync, existsSync, readdirSync, mkdirSync } from 'fs'
import { join, extname, basename } from 'path'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'

const CATALOGUE_DIR = '/Users/nishi/Downloads/VairisCatalogueDriveShare'
const BUCKET = 'product-media'
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.avi']

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const prisma = new PrismaClient()

// Correct order: front → left → right → back → video
const SLOT_ORDER = ['front', 'left', 'right', 'back', 'video']

// folder → itemCode mapping (null = match by name)
const CATALOGUE = [
  { folder: 'Bracelets/01', itemCode: 'AJBR-74',      name: 'Heart Diamond Bracelet' },
  { folder: 'Rings/02',     itemCode: null,             name: 'Emerald Diamond Bangle' },
  { folder: 'Rings/03',     itemCode: 'AJLR-637',      name: 'Double Halo Diamond Ring' },
  { folder: 'Rings/04',     itemCode: 'AJLR-636',      name: 'Solitaire Diamond Ring' },
  { folder: 'Rings/05',     itemCode: 'AJLR-638',      name: 'Pavé Solitaire Ring' },
  { folder: 'Rings/06',     itemCode: 'AJLR-596',      name: 'Triple Leaf Diamond Ring' },
  { folder: 'Rings/07',     itemCode: 'AJLR-587',      name: 'Oval Diamond Eternity Band' },
  { folder: 'Rings/09',     itemCode: 'AJLR-599',      name: 'Geometric Solitaire Ring' },
  { folder: 'Rings/10',     itemCode: 'AJLR-601',      name: 'Blue Topaz Heart Ring' },
  { folder: 'Rings/11',     itemCode: 'AJLR-663',      name: 'Swirl Cluster Ring' },
  { folder: 'Rings/13',     itemCode: 'AJLR-593',      name: 'Bezel Diamond Eternity Band' },
  { folder: 'Rings/14',     itemCode: null,             name: 'Rings/14' },
  { folder: 'Ear_rings/02', itemCode: 'AJER-398',      name: 'Leaf Drop Hoop Earrings' },
  { folder: 'Ear_rings/03', itemCode: 'AJER-319',      name: 'Heart Diamond Stud Earrings' },
  { folder: 'Ear_rings/04', itemCode: 'AJER-310',      name: 'Circle Diamond Stud Earrings' },
  { folder: 'Ear_rings/05', itemCode: 'AJER-318',      name: 'Pear Drop Diamond Earrings' },
  { folder: 'Ear_rings/06', itemCode: 'AJER-335',      name: 'Round Halo Drop Earrings' },
  { folder: 'Ear_rings/07', itemCode: 'AJER-312',      name: 'Hexagon Sapphire Stud Earrings' },
  { folder: 'Ear_rings/08', itemCode: 'AJPS-55-ER',   name: 'Leaf Diamond Stud Earrings' },
  { folder: 'Pendants/01',  itemCode: 'AJPD-195',      name: 'Heart Diamond Pendant' },
  { folder: 'Pendants/02',  itemCode: 'AJPD-197',      name: 'Flower Diamond Pendant' },
  { folder: 'Pendants/03',  itemCode: 'AJPD-200',      name: 'Butterfly Diamond Pendant' },
  { folder: 'Pendants/04',  itemCode: 'AJPD-170',      name: 'Leaf Cluster Pendant' },
  { folder: 'Pendants/05',  itemCode: 'AJPD-171',      name: 'Branch Diamond Pendant' },
]

function getOrderedFiles(folderPath) {
  const files = readdirSync(folderPath).filter(f => {
    const lc = f.toLowerCase()
    if (lc.includes('cad')) return false
    const ext = extname(f).toLowerCase()
    return [...VIDEO_EXT, '.png', '.jpg', '.jpeg'].includes(ext)
  })

  return files
    .sort((a, b) => {
      const ai = SLOT_ORDER.findIndex(o => a.toLowerCase().includes(o))
      const bi = SLOT_ORDER.findIndex(o => b.toLowerCase().includes(o))
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    .map(f => join(folderPath, f))
}

function extractStoragePath(url) {
  const marker = `/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

async function processAndUpload(localPath, folder) {
  const ext = extname(localPath).toLowerCase()
  const isVideo = VIDEO_EXT.includes(ext)
  const newName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${isVideo ? ext.slice(1) : 'jpg'}`
  const storagePath = `products/${isVideo ? 'videos' : 'images'}/${newName}`

  let data
  if (isVideo) {
    data = readFileSync(localPath)
  } else {
    data = await sharp(readFileSync(localPath))
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, data, {
      contentType: isVideo ? 'video/mp4' : 'image/jpeg',
      upsert: false,
    })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return urlData.publicUrl
}

async function deleteOldFiles(oldUrls) {
  const paths = oldUrls.map(extractStoragePath).filter(Boolean)
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) console.warn(`  Warning: could not delete old files: ${error.message}`)
}

async function main() {
  console.log(`\nMigrating ${CATALOGUE.length} products — correct order: front → left → right → back → video\n`)
  console.log('─'.repeat(60))

  let success = 0, failed = 0

  for (const entry of CATALOGUE) {
    const folderPath = join(CATALOGUE_DIR, entry.folder)

    // Find product in DB
    const product = entry.itemCode
      ? await prisma.product.findUnique({ where: { itemCode: entry.itemCode } })
      : await prisma.product.findFirst({ where: { name: entry.name } })

    if (!product) {
      console.log(`SKIP ${entry.folder} — not found in DB (itemCode: ${entry.itemCode ?? 'none'})`)
      continue
    }

    if (!existsSync(folderPath)) {
      console.log(`SKIP ${entry.folder} — local folder not found`)
      continue
    }

    console.log(`\n${product.name}`)

    const files = getOrderedFiles(folderPath)
    if (files.length === 0) {
      console.log('  No media files found — skipping')
      continue
    }

    files.forEach((f, i) => {
      const slot = SLOT_ORDER[i] ?? `slot${i}`
      console.log(`  [${slot}] ${basename(f)}`)
    })

    try {
      const newUrls = []
      for (let i = 0; i < files.length; i++) {
        const slot = SLOT_ORDER[i] ?? `slot${i}`
        const isVideo = VIDEO_EXT.includes(extname(files[i]).toLowerCase())
        process.stdout.write(`  uploading ${slot}...`)
        const url = await processAndUpload(files[i], entry.folder)
        newUrls.push(url)
        console.log(` ✓ ${isVideo ? 'video' : 'Sharp 1200px JPEG'}`)
      }

      // Delete old files then update DB
      await deleteOldFiles(product.images)
      await prisma.product.update({
        where: { id: product.id },
        data: { images: newUrls },
      })

      console.log(`  DB updated ✓ (${newUrls.length} media)`)
      success++
    } catch (e) {
      console.error(`  FAILED: ${e.message}`)
      failed++
    }

    console.log('─'.repeat(60))
  }

  console.log(`\nDone — Success: ${success} | Failed: ${failed}`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
