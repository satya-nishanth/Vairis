/**
 * Bulk upload new Vairis catalogue with aggressive compression.
 *
 * Images : Sharp 800px JPEG q65    — ~40KB avg (was ~140KB)
 * Videos : ffmpeg 480p H.264 CRF30 — ~2.5MB avg (was ~19MB), audio stripped
 * Defaults tuned for 300+ product budget (143 now + 180 more).
 *
 * Folder name format: "AJBB0871LR_R REG"
 *   itemCode  = everything before first underscore  → AJBB0871LR
 *   category  = letter after underscore + space     → R=RINGS E=EARRINGS P=PENDANTS B=BRACELETS
 *   fallback  = trailing alpha chars of itemCode    → LR/GR=RINGS, ER/ST/PS/CS=EARRINGS,
 *                                                      PD/NP/NS/PND/PSET/NL/MS=PENDANTS,
 *                                                      BR/CUF/BNL=BRACELETS
 *
 * Products not in DB → stub created (isActive=false). Admin fills name/pricing/variants.
 * Products already in DB → images array replaced.
 * Resume-safe: state saved to scripts/.upload-new-catalogue-state.json after each product.
 *
 * Run:
 *   export $(grep -v '^#' .env.prod | xargs) && node scripts/upload-new-catalogue.mjs
 *   node scripts/upload-new-catalogue.mjs --dry-run
 *   node scripts/upload-new-catalogue.mjs --dir "/path/to/catalogue"
 *   node scripts/upload-new-catalogue.mjs --crf 28        # higher quality, more space
 *   node scripts/upload-new-catalogue.mjs --720p          # 720p video, more space
 */

import { readFileSync, existsSync, readdirSync, writeFileSync, statSync } from 'fs'
import { join, extname, basename } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'

// ── Config ────────────────────────────────────────────────────────────────────

const CATALOGUE_DIR = (() => {
  const i = process.argv.indexOf('--dir')
  return i !== -1 ? process.argv[i + 1] : '/Users/nishi/Downloads/VairisCatalogue'
})()
const BUCKET = 'product-media'
const STATE_FILE = join(
  process.cwd(),
  `scripts/.upload-catalogue-state-${Buffer.from(CATALOGUE_DIR).toString('base64').slice(-12).replace(/[/+=]/g, '_')}.json`
)
const VIDEO_EXT = ['.mp4', '.webm', '.mov']

const DRY_RUN = process.argv.includes('--dry-run')
const CRF = (() => {
  const i = process.argv.indexOf('--crf')
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : 30
})()
const VIDEO_HEIGHT = process.argv.includes('--720p') ? 720 : 480
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : Infinity
})()

// ── Category maps ─────────────────────────────────────────────────────────────

const LETTER_MAP = { R: 'RINGS', E: 'EARRINGS', P: 'PENDANTS', B: 'BRACELETS' }
const CODE_SUFFIX_MAP = {
  // Rings
  LR: 'RINGS', GR: 'RINGS',
  // Earrings
  ER: 'EARRINGS', ST: 'EARRINGS', PS: 'EARRINGS', CS: 'EARRINGS',
  // Pendants (+ nose pins, necklaces, maang sets — closest category)
  PD: 'PENDANTS', PND: 'PENDANTS', PSET: 'PENDANTS',
  NL: 'PENDANTS', NS: 'PENDANTS', NP: 'PENDANTS', MS: 'PENDANTS',
  // Bracelets / bangles
  BR: 'BRACELETS', CUF: 'BRACELETS', BNL: 'BRACELETS', BB: 'BRACELETS', BA: 'BRACELETS',
  // Pendants / necklaces / maang tikka
  N: 'PENDANTS', MT: 'PENDANTS',
}

// ── Env check ─────────────────────────────────────────────────────────────────

if (!DRY_RUN && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = DRY_RUN ? null : createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const prisma = DRY_RUN ? null : new PrismaClient({
  datasources: {
    db: {
      url: (() => {
        const u = process.env.DATABASE_URL ?? ''
        const sep = u.includes('?') ? '&' : '?'
        return u.includes('pgbouncer') ? u : `${u}${sep}pgbouncer=true&connection_limit=1`
      })(),
    },
  },
})

// ── State ─────────────────────────────────────────────────────────────────────

function loadState() {
  if (!existsSync(STATE_FILE)) return {}
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) } catch { return {} }
}
function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

// ── Folder parsing ────────────────────────────────────────────────────────────

function parseFolderName(name) {
  const idx = name.indexOf('_')
  if (idx === -1) return null

  const itemCode = name.slice(0, idx)
  const suffix = name.slice(idx + 1)

  // Primary: single letter followed by space — "R REG", "E PAV", "P HAN"
  const letterMatch = suffix.match(/^([REPB])\s/)
  if (letterMatch) {
    const category = LETTER_MAP[letterMatch[1]]
    if (category) return { itemCode, category }
  }

  // Fallback: trailing alpha suffix of itemCode — "AJCO3025ER" → ER, "AJBB0539CUF" → CUF
  // Strip trailing non-alpha (e.g. "P.SET" → "PSET") before matching
  const cleanCode = itemCode.replace(/[^A-Z0-9]/g, '')
  const codeMatch = cleanCode.match(/[A-Z]+$/)
  if (codeMatch) {
    const tail = codeMatch[0]
    // Exact match first
    if (CODE_SUFFIX_MAP[tail]) return { itemCode, category: CODE_SUFFIX_MAP[tail] }
    // Compound suffix (e.g. NLER, NKER) — check if it ends with a known type
    for (const known of Object.keys(CODE_SUFFIX_MAP).sort((a, b) => b.length - a.length)) {
      if (tail.length > known.length && tail.endsWith(known)) {
        return { itemCode, category: CODE_SUFFIX_MAP[known] }
      }
    }
  }

  return null
}

// ── File ordering ─────────────────────────────────────────────────────────────

function getOrderedFiles(folderPath) {
  const all = readdirSync(folderPath).filter(f => {
    const ext = extname(f).toLowerCase()
    return [...VIDEO_EXT, '.jpg', '.jpeg', '.png'].includes(ext)
  })

  const images = all
    .filter(f => !VIDEO_EXT.includes(extname(f).toLowerCase()))
    .sort((a, b) => {
      const na = parseInt(basename(a, extname(a)), 10)
      const nb = parseInt(basename(b, extname(b)), 10)
      return (isNaN(na) ? 999 : na) - (isNaN(nb) ? 999 : nb)
    })

  const videos = all.filter(f => VIDEO_EXT.includes(extname(f).toLowerCase()))

  return [...images, ...videos].map(f => join(folderPath, f))
}

// ── Compression ───────────────────────────────────────────────────────────────

async function compressImage(localPath) {
  const raw = readFileSync(localPath)
  const buf = await sharp(raw)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 65, mozjpeg: true })
    .toBuffer()
  return { buf, originalSize: raw.length, compressedSize: buf.length }
}

function compressVideo(localPath) {
  const originalSize = statSync(localPath).size
  const tmp = join(tmpdir(), `vairis-${Date.now()}.mp4`)
  try {
    execSync(
      `ffmpeg -y -i "${localPath}" -vf "scale=-2:${VIDEO_HEIGHT}" -c:v libx264 -crf ${CRF} -preset slow -an -movflags +faststart "${tmp}"`,
      { stdio: 'pipe', timeout: 300_000 },
    )
    const buf = readFileSync(tmp)
    return { buf, originalSize, compressedSize: buf.length }
  } finally {
    try { execSync(`rm -f "${tmp}"`, { stdio: 'ignore' }) } catch {}
  }
}

// ── Upload ────────────────────────────────────────────────────────────────────

async function uploadBuf(buf, isVideo) {
  const ext = isVideo ? 'mp4' : 'jpg'
  const path = `products/${isVideo ? 'videos' : 'images'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: isVideo ? 'video/mp4' : 'image/jpeg',
    upsert: false,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtBytes(b) {
  if (b < 1048576) return `${(b / 1024).toFixed(0)}KB`
  return `${(b / 1048576).toFixed(1)}MB`
}
function pct(orig, comp) {
  return `${Math.round((1 - comp / orig) * 100)}% saved`
}

// ── Dry run ───────────────────────────────────────────────────────────────────

function dryRunReport(folders) {
  let imgCount = 0, vidCount = 0, rawImg = 0, rawVid = 0, unrecognised = 0

  for (const { folderPath, parsed } of folders) {
    if (!parsed) { unrecognised++; continue }
    const files = getOrderedFiles(folderPath)
    for (const f of files) {
      const isVid = VIDEO_EXT.includes(extname(f).toLowerCase())
      const size = statSync(f).size
      if (isVid) { vidCount++; rawVid += size }
      else { imgCount++; rawImg += size }
    }
  }

  const estImg = imgCount * 40_000
  const estVid = vidCount * (VIDEO_HEIGHT === 720 ? 5_000_000 : 2_500_000)
  const totalEst = estImg + estVid
  const usedNow = 120 * 1048576
  const afterMB = ((usedNow + totalEst) / 1048576).toFixed(0)
  const pctUsed = Math.round((usedNow + totalEst) / (1024 * 1048576) * 100)

  // Headroom projection for 180 more products (same density)
  const ratio = folders.filter(f => f.parsed).length || folders.length
  const nextImgEst = Math.round(imgCount / ratio * 180) * 40_000
  const nextVidEst = Math.round(vidCount / ratio * 180) * (VIDEO_HEIGHT === 720 ? 5_000_000 : 2_500_000)
  const grandTotal = (usedNow + totalEst + nextImgEst + nextVidEst) / 1048576

  console.log('\n━━━ DRY RUN — STORAGE ESTIMATE ━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Folders found:   ${folders.length}  (${unrecognised} unrecognised, will skip)`)
  console.log(`Images:          ${imgCount}  raw ${fmtBytes(rawImg)}  → est. ${fmtBytes(estImg)}  (Sharp q65, 800px)`)
  console.log(`Videos:          ${vidCount}  raw ${fmtBytes(rawVid)}  → est. ${fmtBytes(estVid)}  (H.264 CRF${CRF}, ${VIDEO_HEIGHT}p, no audio)`)
  console.log('')
  console.log(`Supabase now:       120MB / 1024MB`)
  console.log(`After this batch:   ~${afterMB}MB / 1024MB  (${pctUsed}% used)`)
  console.log(`After +180 more:    ~${grandTotal.toFixed(0)}MB / 1024MB  (${Math.round(grandTotal / 1024 * 100)}% used)`)

  if (grandTotal > 900) {
    console.log('\n⚠  Will be tight after 180 more. Options:')
    console.log('   --crf 32    → ~20% smaller videos')
  } else {
    console.log('\n✓  Comfortable headroom for 180 more products')
  }

  console.log('\n━━━ FOLDER PARSE PREVIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  for (const { folderName, parsed } of folders.slice(0, 15)) {
    if (parsed) console.log(`  ✓  ${folderName.padEnd(36)}→ ${parsed.itemCode}  (${parsed.category})`)
    else         console.log(`  ✗  ${folderName}  [SKIP — unrecognised]`)
  }
  if (folders.length > 15) console.log(`  ... and ${folders.length - 15} more`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const allNames = readdirSync(CATALOGUE_DIR).filter(f => !f.startsWith('.'))

  const folders = allNames
    .map(name => {
      const folderPath = join(CATALOGUE_DIR, name)
      if (!statSync(folderPath).isDirectory()) return null
      const parsed = parseFolderName(name)
      return { folderName: name, folderPath, parsed }
    })
    .filter(Boolean)

  console.log(`Found ${folders.length} folders`)

  if (DRY_RUN) { dryRunReport(folders); return }

  const state = loadState()
  let created = 0, updated = 0, skipped = 0, failed = 0
  const validFolders = folders.filter(f => f.parsed)

  if (folders.length !== validFolders.length) {
    console.warn(`\n⚠  ${folders.length - validFolders.length} folder(s) skipped — unrecognised name format:`)
    folders.filter(f => !f.parsed).forEach(f => console.warn(`   ${f.folderName}`))
  }

  const runFolders = validFolders.slice(0, LIMIT)
  if (LIMIT !== Infinity) console.log(`\n⚡ Limited to ${LIMIT} products (--limit flag)\n`)

  for (let i = 0; i < runFolders.length; i++) {
    const { folderName, folderPath, parsed: { itemCode, category } } = runFolders[i]
    const tag = `[${i + 1}/${runFolders.length}] ${itemCode}`

    if (state[itemCode]?.done) {
      console.log(`${tag} — already done, skipping`)
      skipped++
      continue
    }

    const files = getOrderedFiles(folderPath)
    if (files.length === 0) {
      console.log(`${tag} — no media files, skipping`)
      skipped++
      continue
    }

    const imgFiles = files.filter(f => !VIDEO_EXT.includes(extname(f).toLowerCase()))
    const vidFiles = files.filter(f => VIDEO_EXT.includes(extname(f).toLowerCase()))
    console.log(`\n${tag} — ${imgFiles.length} image(s) + ${vidFiles.length} video(s)`)

    try {
      const urls = []
      let totalRaw = 0, totalComp = 0

      for (const file of files) {
        const isVid = VIDEO_EXT.includes(extname(file).toLowerCase())
        process.stdout.write(`  ${basename(file)}  `)

        const { buf, originalSize, compressedSize } = isVid
          ? compressVideo(file)
          : await compressImage(file)

        const url = await uploadBuf(buf, isVid)
        urls.push(url)
        totalRaw += originalSize
        totalComp += compressedSize

        console.log(`${fmtBytes(originalSize)} → ${fmtBytes(compressedSize)} (${pct(originalSize, compressedSize)})`)
      }

      console.log(`  ↳ total ${fmtBytes(totalRaw)} → ${fmtBytes(totalComp)} (${pct(totalRaw, totalComp)})`)

      const existing = await prisma.product.findUnique({ where: { itemCode } })
      if (existing) {
        await prisma.product.update({ where: { itemCode }, data: { images: urls } })
        console.log(`  ✓ updated existing product`)
        updated++
      } else {
        await prisma.product.create({
          data: {
            name: itemCode,
            description: '',
            category,
            itemCode,
            images: urls,
            isActive: false,
          },
        })
        console.log(`  ✓ created stub (isActive=false — fill name/pricing in admin)`)
        created++
      }

      state[itemCode] = { done: true, uploadedAt: new Date().toISOString(), urls }
      saveState(state)
    } catch (e) {
      console.error(`  ✗ FAILED: ${e.message}`)
      state[itemCode] = { done: false, error: e.message }
      saveState(state)
      failed++
    }
  }

  console.log(`\n${'─'.repeat(55)}`)
  console.log(`Done — Created: ${created} | Updated: ${updated} | Skipped: ${skipped} | Failed: ${failed}`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
