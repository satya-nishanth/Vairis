/**
 * Vairis Catalogue Bulk Upload Script
 *
 * Reads each product folder, compresses PNGs → JPEG (sips, macOS built-in),
 * uploads all media to Supabase Storage, creates products in DB via Prisma.
 *
 * Run: node scripts/upload-catalogue.mjs
 * Requires: supabase start (local stack running)
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, extname, basename } from 'path'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const CATALOGUE_DIR = '/Users/nishi/Downloads/VairisCatalogueDriveShare'
const TMP_DIR = '/tmp/vairis-upload-compressed'
const BUCKET = 'product-media'
const SUPABASE_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
const IMAGE_QUALITY = 82   // JPEG quality for compressed PNGs
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.avi']
const IMAGE_EXT = ['.png', '.jpg', '.jpeg']

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const prisma = new PrismaClient()
mkdirSync(TMP_DIR, { recursive: true })

// ── Complete catalogue compiled from CAD images ─────────────────────────────
const CATALOGUE = [
  // ── BRACELETS ──────────────────────────────────────────────────────────────
  {
    folder: 'Bracelets/01', category: 'BRACELETS', itemCode: 'AJBR-74',
    name: 'Heart Diamond Bracelet',
    description: 'Alternating open heart motifs and bezel-set round diamonds. Lightweight design for daily wear.',
    designStyle: 'Alternating open heart motifs and bezel-set round stones',
    totalLengthMm: 152.4, motifSizeMm: 9, thicknessMm: 2.7,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '4.80 x 4.80', gemCount: 5, caratWeight: 2.00,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 8.500, makingChargePerGram: 500, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 5.950, makingChargePerGram: 50, miscCharges: 45 },
    ],
  },
  {
    folder: 'Rings/02', category: 'BRACELETS', itemCode: null,
    name: 'Emerald Diamond Bangle',
    description: 'Ornate filigree bangle with central oval emerald and pavé diamonds throughout.',
    designStyle: 'Ornate filigree cuff with central emerald and diamond pavé',
    totalLengthMm: null, motifSizeMm: 27.5, thicknessMm: null,
    stoneType: 'Diamond & Emerald', stoneShape: 'Round & Oval', stoneDimMm: '8.50 x 6.50 (emerald)', gemCount: 161, caratWeight: 3.14,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 32.41, makingChargePerGram: 600, miscCharges: 45 },
      { metalType: 'GOLD_22K', weightGrams: 27.70, makingChargePerGram: 600, miscCharges: 45 },
    ],
  },
  // ── RINGS ──────────────────────────────────────────────────────────────────
  {
    folder: 'Rings/03', category: 'RINGS', itemCode: 'AJLR-637',
    name: 'Double Halo Diamond Ring',
    description: 'Double concentric halo diamond ring with pavé band.',
    designStyle: 'Double concentric halo setting with pavé band',
    totalLengthMm: null, motifSizeMm: 10.5, thicknessMm: 1.9,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '4.30 x 4.30', gemCount: 62, caratWeight: 0.85,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 3.100, size: '15', makingChargePerGram: 450, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 2.108, size: '15', makingChargePerGram: 60, miscCharges: 45 },
    ],
  },
  {
    folder: 'Rings/04', category: 'RINGS', itemCode: 'AJLR-636',
    name: 'Solitaire Diamond Ring',
    description: 'Elegant solitaire with fleur-de-lis shoulder accents on a tapered band.',
    designStyle: 'Solitaire with fleur-de-lis accent stones on tapered band',
    totalLengthMm: null, motifSizeMm: 6.5, thicknessMm: 2.0,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '5.76 x 5.78', gemCount: 27, caratWeight: 0.86,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 3.100, size: '15', makingChargePerGram: 400, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 2.108, size: '15', makingChargePerGram: 60, miscCharges: 45 },
    ],
  },
  {
    folder: 'Rings/05', category: 'RINGS', itemCode: 'AJLR-638',
    name: 'Pavé Solitaire Ring',
    description: 'Solitaire diamond in a full pavé diamond band.',
    designStyle: 'Solitaire in split pavé diamond band',
    totalLengthMm: null, motifSizeMm: 5.5, thicknessMm: 1.8,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '5.13 x 5.17', gemCount: 87, caratWeight: 0.93,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 2.300, size: '15', makingChargePerGram: 450, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 1.564, size: '15', makingChargePerGram: 60, miscCharges: 45 },
    ],
  },
  {
    folder: 'Rings/06', category: 'RINGS', itemCode: 'AJLR-596',
    name: 'Triple Leaf Diamond Ring',
    description: 'Three open leaf petals set with round diamonds on a slim band.',
    designStyle: 'Three open leaf petals set with diamonds',
    totalLengthMm: null, motifSizeMm: 14.5, thicknessMm: 1.8,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '1.30 mm', gemCount: 37, caratWeight: 0.37,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 3.700, size: '12', makingChargePerGram: 450, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 2.590, size: '12', makingChargePerGram: 60, miscCharges: 45 },
    ],
  },
  {
    folder: 'Rings/07', category: 'RINGS', itemCode: 'AJLR-587',
    name: 'Oval Diamond Eternity Band',
    description: 'Full eternity band set with oval cut diamonds.',
    designStyle: 'Oval diamond full eternity band',
    totalLengthMm: null, motifSizeMm: 5.5, thicknessMm: 3.0,
    stoneType: 'Diamond', stoneShape: 'Oval', stoneDimMm: '5.50 x 3.50', gemCount: 20, caratWeight: 5.07,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 3.400, size: '16', makingChargePerGram: 500, miscCharges: 45 },
      { metalType: 'GOLD_22K', weightGrams: 2.890, size: '16', makingChargePerGram: 500, miscCharges: 45 },
    ],
  },
  {
    folder: 'Rings/09', category: 'RINGS', itemCode: 'AJLR-599',
    name: 'Geometric Solitaire Ring',
    description: 'Bold geometric faceted band with solitaire diamond.',
    designStyle: 'Geometric faceted band with solitaire prong setting',
    totalLengthMm: null, motifSizeMm: 6.2, thicknessMm: 4.0,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '6.20 x 6.20', gemCount: 1, caratWeight: 0.89,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 4.800, size: '14', makingChargePerGram: 400, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 3.360, size: '14', makingChargePerGram: 60, miscCharges: 45 },
    ],
  },
  {
    folder: 'Rings/10', category: 'RINGS', itemCode: 'AJLR-601',
    name: 'Blue Topaz Heart Ring',
    description: 'Heart-shaped blue topaz centre with diamond accents on an ornate band.',
    designStyle: 'Heart blue topaz in ornate diamond-set filigree band',
    totalLengthMm: null, motifSizeMm: 7.0, thicknessMm: 4.0,
    stoneType: 'Blue Topaz & Diamond', stoneShape: 'Heart & Round', stoneDimMm: '6.20 x 6.90 (topaz)', gemCount: 24, caratWeight: 1.30,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 4.900, size: '14', makingChargePerGram: 500, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 3.430, size: '14', makingChargePerGram: 60, miscCharges: 45 },
    ],
  },
  {
    folder: 'Rings/11', category: 'RINGS', itemCode: 'AJLR-663',
    name: 'Swirl Cluster Ring',
    description: 'Elegant swirling cluster ring with pavé diamonds in an oval motif.',
    designStyle: 'Swirl band with oval diamond cluster centre',
    totalLengthMm: null, motifSizeMm: 13.0, thicknessMm: 2.5,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '1.30 mm', gemCount: 40, caratWeight: 0.40,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 3.900, size: '20', makingChargePerGram: 450, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 2.730, size: '20', makingChargePerGram: 60, miscCharges: 45 },
    ],
  },
  {
    folder: 'Rings/13', category: 'RINGS', itemCode: 'AJLR-593',
    name: 'Bezel Diamond Eternity Band',
    description: 'Minimalist eternity band with bezel-set diamonds.',
    designStyle: 'Bezel-set diamond eternity band',
    totalLengthMm: null, motifSizeMm: 2.3, thicknessMm: 2.3,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '1.30 mm', gemCount: 16, caratWeight: 0.16,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 2.600, size: '12', makingChargePerGram: 350, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 1.820, size: '12', makingChargePerGram: 50, miscCharges: 45 },
    ],
  },
  // ── EARRINGS ───────────────────────────────────────────────────────────────
  {
    folder: 'Ear_rings/02', category: 'EARRINGS', itemCode: 'AJER-398',
    name: 'Leaf Drop Hoop Earrings',
    description: 'Elongated J-hoop earrings set with alternating marquise and pear diamonds.',
    designStyle: 'J-hoop with alternating marquise and pear diamond settings',
    totalLengthMm: 44, motifSizeMm: 22, thicknessMm: 8.5,
    stoneType: 'Diamond', stoneShape: 'Marquise & Pear', stoneDimMm: '3.00 x 1.50 (marquise), 3.00 x 2.00 (pear)', gemCount: 90, caratWeight: 3.05,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 14.500, makingChargePerGram: 500, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 9.860, makingChargePerGram: 80, miscCharges: 45 },
    ],
  },
  {
    folder: 'Ear_rings/03', category: 'EARRINGS', itemCode: 'AJER-319',
    name: 'Heart Diamond Stud Earrings',
    description: 'Heart-shaped double halo diamond studs with full pavé fill.',
    designStyle: 'Heart-shaped double halo with pavé diamond fill',
    totalLengthMm: null, motifSizeMm: 12, thicknessMm: 4.2,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: 'Various (1.30–2.70 mm)', gemCount: 72, caratWeight: 1.06,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 4.800, makingChargePerGram: 450, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 3.360, makingChargePerGram: 70, miscCharges: 45 },
    ],
  },
  {
    folder: 'Ear_rings/04', category: 'EARRINGS', itemCode: 'AJER-310',
    name: 'Circle Diamond Stud Earrings',
    description: 'Minimal open circle diamond stud earrings.',
    designStyle: 'Open circle with prong-set diamonds',
    totalLengthMm: null, motifSizeMm: 8.6, thicknessMm: 2.7,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '1.50 mm', gemCount: 24, caratWeight: 0.36,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 2.000, makingChargePerGram: 400, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 1.400, makingChargePerGram: 60, miscCharges: 45 },
    ],
  },
  {
    folder: 'Ear_rings/05', category: 'EARRINGS', itemCode: 'AJER-318',
    name: 'Pear Drop Diamond Earrings',
    description: 'Large pear-shaped diamond drop earrings with flower cluster tops.',
    designStyle: 'Flower cluster top with cascading pear diamond drop',
    totalLengthMm: 21.4, motifSizeMm: null, thicknessMm: 4.0,
    stoneType: 'Diamond', stoneShape: 'Pear & Round', stoneDimMm: '9.00 x 6.00 (pear)', gemCount: 22, caratWeight: 2.60,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 3.000, makingChargePerGram: 500, miscCharges: 45 },
    ],
  },
  {
    folder: 'Ear_rings/06', category: 'EARRINGS', itemCode: 'AJER-335',
    name: 'Round Halo Drop Earrings',
    description: 'Round brilliant diamond with halo in elegant lever-back drop setting.',
    designStyle: 'Round brilliant halo in lever-back drop setting',
    totalLengthMm: 18, motifSizeMm: 12, thicknessMm: null,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '6.50 x 6.50', gemCount: 48, caratWeight: 2.52,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 4.700, makingChargePerGram: 500, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 3.290, makingChargePerGram: 70, miscCharges: 45 },
    ],
  },
  {
    folder: 'Ear_rings/07', category: 'EARRINGS', itemCode: 'AJER-312',
    name: 'Hexagon Sapphire Stud Earrings',
    description: 'Hexagonal blue sapphire centre stone surrounded by diamond halo.',
    designStyle: 'Hexagon sapphire in diamond starburst halo',
    totalLengthMm: null, motifSizeMm: 13.8, thicknessMm: 5.6,
    stoneType: 'Blue Sapphire & Diamond', stoneShape: 'Hexagon & Round', stoneDimMm: 'Various (1.30–2.20 mm)', gemCount: 36, caratWeight: 0.78,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 4.400, makingChargePerGram: 450, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 3.080, makingChargePerGram: 70, miscCharges: 45 },
    ],
  },
  {
    folder: 'Ear_rings/08', category: 'EARRINGS', itemCode: 'AJPS-55-ER',
    name: 'Leaf Diamond Stud Earrings',
    description: 'Dainty three-petal leaf studs with bezel-set round diamond accent.',
    designStyle: 'Three-petal leaf with bezel-set diamond',
    totalLengthMm: null, motifSizeMm: 10, thicknessMm: 1.5,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '1.50 mm', gemCount: 2, caratWeight: 0.03,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 2.000, makingChargePerGram: 400, miscCharges: 45 },
    ],
  },
  // ── PENDANTS ───────────────────────────────────────────────────────────────
  {
    folder: 'Pendants/01', category: 'PENDANTS', itemCode: 'AJPD-195',
    name: 'Heart Diamond Pendant',
    description: 'Heart-shaped pavé diamond pendant with decorative double bail.',
    designStyle: 'Heart pavé diamond pendant with decorative double bail',
    totalLengthMm: 14.80, motifSizeMm: null, thicknessMm: 2.6,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '1.30–1.50 mm', gemCount: 18, caratWeight: 0.26,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 1.500, makingChargePerGram: 400, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 1.050, makingChargePerGram: 60, miscCharges: 45 },
    ],
  },
  {
    folder: 'Pendants/02', category: 'PENDANTS', itemCode: 'AJPD-197',
    name: 'Flower Diamond Pendant',
    description: 'Daisy-inspired open petal pendant with diamond cluster centre.',
    designStyle: 'Open petal flower with diamond cluster centre',
    totalLengthMm: 15, motifSizeMm: null, thicknessMm: 3.8,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '1.50–2.00 mm', gemCount: 22, caratWeight: 0.41,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 1.700, makingChargePerGram: 400, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 1.156, makingChargePerGram: 60, miscCharges: 45 },
    ],
  },
  {
    folder: 'Pendants/03', category: 'PENDANTS', itemCode: 'AJPD-200',
    name: 'Butterfly Diamond Pendant',
    description: 'Four-petal butterfly pendant with scattered diamond accents.',
    designStyle: 'Butterfly silhouette with scattered prong-set diamonds',
    totalLengthMm: 15, motifSizeMm: null, thicknessMm: 2.5,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '1.70 mm', gemCount: 22, caratWeight: 0.44,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 3.000, makingChargePerGram: 400, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 2.040, makingChargePerGram: 60, miscCharges: 45 },
    ],
  },
  {
    folder: 'Pendants/04', category: 'PENDANTS', itemCode: 'AJPD-170',
    name: 'Leaf Cluster Pendant',
    description: 'Three open leaf cluster pendant with pavé diamond borders.',
    designStyle: 'Three open leaf petals with pavé diamond borders',
    totalLengthMm: 16.5, motifSizeMm: null, thicknessMm: 1.2,
    stoneType: 'Diamond', stoneShape: 'Round', stoneDimMm: '1.30 mm', gemCount: 37, caratWeight: 0.37,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 1.500, makingChargePerGram: 400, miscCharges: 45 },
      { metalType: 'SILVER_925', weightGrams: 1.050, makingChargePerGram: 60, miscCharges: 45 },
    ],
  },
  {
    folder: 'Pendants/05', category: 'PENDANTS', itemCode: 'AJPD-171',
    name: 'Branch Diamond Pendant',
    description: 'Delicate gold branch pendant with marquise diamond leaves.',
    designStyle: 'Branch with marquise diamond leaf settings',
    totalLengthMm: null, motifSizeMm: 9.8, thicknessMm: 1.8,
    stoneType: 'Diamond', stoneShape: 'Marquise & Round', stoneDimMm: '1.30 mm', gemCount: 4, caratWeight: 0.04,
    variants: [
      { metalType: 'GOLD_18K', weightGrams: 0.900, makingChargePerGram: 400, miscCharges: 45 },
    ],
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`) }
function err(msg) { console.error(`  ❌ ${msg}`) }

/** Compress PNG → JPEG using macOS sips (no dependencies) */
function compressPng(src, destDir) {
  const name = basename(src, extname(src)) + '.jpg'
  const dest = join(destDir, name)
  execSync(`sips -s format jpeg -s formatOptions ${IMAGE_QUALITY} "${src}" --out "${dest}"`, { stdio: 'ignore' })
  return dest
}

/** Get ordered media files from product folder (excludes CAD — technical ref only) */
function getMediaFiles(folderPath) {
  const all = readdirSync(folderPath)
  const order = ['front', 'back', 'left', 'right', 'video']
  return all
    .filter(f => {
      const lc = f.toLowerCase()
      if (lc.includes('cad')) return false   // skip CAD reference images
      return [...IMAGE_EXT, ...VIDEO_EXT].includes(extname(f).toLowerCase())
    })
    .sort((a, b) => {
      const ai = order.findIndex(o => a.toLowerCase().includes(o))
      const bi = order.findIndex(o => b.toLowerCase().includes(o))
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    .map(f => join(folderPath, f))
}

/** Ensure bucket exists */
async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
    fileSizeLimit: 50 * 1024 * 1024,
  })
  if (error && !error.message.toLowerCase().includes('already exist')) throw error
}

/** Upload one file to storage, return public URL */
async function uploadFile(localPath, storagePath) {
  const ext = extname(localPath).toLowerCase()
  const isVid = VIDEO_EXT.includes(ext)
  const contentType = isVid ? 'video/mp4' : 'image/jpeg'
  const data = readFileSync(localPath)

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, data, {
    contentType, upsert: true,
  })
  if (error) throw new Error(error.message)
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return publicUrl
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`Starting upload of ${CATALOGUE.length} products`)
  await ensureBucket()
  log('Bucket ready')

  let created = 0, skipped = 0, failed = 0

  for (const product of CATALOGUE) {
    const folderPath = join(CATALOGUE_DIR, product.folder)
    if (!existsSync(folderPath)) { err(`Folder not found: ${folderPath}`); failed++; continue }

    // Skip if already in DB
    if (product.itemCode) {
      const existing = await prisma.product.findUnique({ where: { itemCode: product.itemCode } })
      if (existing) { log(`  ⏭  Skipped (exists): ${product.name}`); skipped++; continue }
    }

    log(`Uploading: ${product.name} (${product.folder})`)

    try {
      // Compress + upload media
      const tmpProductDir = join(TMP_DIR, product.folder.replace('/', '-'))
      mkdirSync(tmpProductDir, { recursive: true })

      const mediaFiles = getMediaFiles(folderPath)
      const uploadedUrls = []

      for (const filePath of mediaFiles) {
        const ext = extname(filePath).toLowerCase()
        const isVid = VIDEO_EXT.includes(ext)
        let uploadPath = filePath

        if (!isVid && ext === '.png') {
          // Compress PNG → JPEG before upload
          uploadPath = compressPng(filePath, tmpProductDir)
        }

        const storageName = basename(uploadPath)
        const storageKey = `products/${product.folder.replace('/', '/')}/${storageName}`

        const url = await uploadFile(uploadPath, storageKey)
        uploadedUrls.push(url)
        log(`  ✓ ${basename(filePath)} → ${isVid ? 'video' : `JPEG ${IMAGE_QUALITY}%`}`)
      }

      // Images first (non-video), then video
      const images = uploadedUrls.filter(u => !VIDEO_EXT.some(v => u.toLowerCase().includes(v)))
      // Videos are also stored in images array (our schema handles both)
      const videos = uploadedUrls.filter(u => VIDEO_EXT.some(v => u.toLowerCase().includes(v)))
      const allMedia = [...images, ...videos]

      // Create product in DB
      const itemCodeSuffix = product.itemCode ?? product.folder.replace('/', '-')
      await prisma.product.create({
        data: {
          name: product.name,
          description: product.description,
          category: product.category,
          itemCode: product.itemCode ?? null,
          designStyle: product.designStyle ?? null,
          totalLengthMm: product.totalLengthMm ?? null,
          motifSizeMm: product.motifSizeMm ?? null,
          thicknessMm: product.thicknessMm ?? null,
          stoneType: product.stoneType ?? null,
          stoneShape: product.stoneShape ?? null,
          stoneDimMm: product.stoneDimMm ?? null,
          gemCount: product.gemCount ?? null,
          caratWeight: product.caratWeight ?? null,
          images: allMedia,
          isActive: true,
          variants: {
            create: product.variants.map((v, i) => ({
              metalType: v.metalType,
              weightGrams: v.weightGrams,
              makingChargePerGram: v.makingChargePerGram,
              flatMakingCharge: 0,
              stoneCharges: 0,
              miscCharges: v.miscCharges,
              stock: 0,
              size: v.size ?? null,
              sku: `${product.itemCode ?? itemCodeSuffix}-${v.metalType.replace('_', '').replace('K', 'k')}${v.size ? `-${v.size}` : ''}`,
            })),
          },
        },
      })

      log(`  ✅ Created: ${product.name} (${product.variants.length} variants, ${allMedia.length} media)`)
      created++
    } catch (e) {
      err(`Failed ${product.name}: ${e.message}`)
      failed++
    }
  }

  log(`\nDone — Created: ${created} | Skipped: ${skipped} | Failed: ${failed}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
