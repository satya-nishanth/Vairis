import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { requireAdmin } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { uploadProductMedia } from '@/lib/azure-blob'

export const dynamic = 'force-dynamic'

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER ?? 'supabase'
const PRODUCT_BUCKET = 'product-media'
/** Dedicated bucket so PDF isn't blocked by product-media image/video allowlist. */
const ORDERS_BUCKET = 'orders-attachments'
const SIZE_LIMIT = 20 * 1024 * 1024

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]

async function ensureOrdersBucket() {
  const admin = getSupabaseAdmin()
  const { data: buckets } = await admin.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === ORDERS_BUCKET)
  if (exists) {
    await admin.storage.updateBucket(ORDERS_BUCKET, {
      public: true,
      allowedMimeTypes: ALLOWED_TYPES,
      fileSizeLimit: SIZE_LIMIT,
    })
    return
  }
  const { error } = await admin.storage.createBucket(ORDERS_BUCKET, {
    public: true,
    allowedMimeTypes: ALLOWED_TYPES,
    fileSizeLimit: SIZE_LIMIT,
  })
  if (error && !error.message.toLowerCase().includes('already exist')) throw error
}

function resolveContentType(file: File): string {
  if (file.type && ALLOWED_TYPES.includes(file.type)) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.gif')) return 'image/gif'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  return file.type || ''
}

/**
 * POST /api/admin/orders/upload — images + PDF for internal order attachments.
 */
export async function POST(req: NextRequest) {
  await requireAdmin()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const contentType = resolveContentType(file)
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      {
        error: `Unsupported type: ${file.type || contentType || 'unknown'}. Allowed: jpg/png/webp/gif and pdf.`,
      },
      { status: 400 },
    )
  }
  if (file.size > SIZE_LIMIT) {
    return NextResponse.json({ error: 'File must be under 20MB' }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const isPdf = contentType === 'application/pdf'
  const ext = isPdf ? 'pdf' : 'jpg'
  const path = `orders/attachments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  let body: Buffer = buffer
  if (!isPdf) {
    body = await sharp(buffer)
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
  }

  const ct = isPdf ? contentType : 'image/jpeg'

  if (STORAGE_PROVIDER === 'azure') {
    const url = await uploadProductMedia(path, body, ct)
    return NextResponse.json({ url, fileName: file.name, contentType: ct })
  }

  await ensureOrdersBucket()
  const admin = getSupabaseAdmin()
  let { error } = await admin.storage.from(ORDERS_BUCKET).upload(path, body, {
    contentType: ct,
    upsert: false,
  })
  if (error) {
    // Fallback: product-media (images only) if dedicated bucket unavailable.
    if (!isPdf) {
      const fb = await admin.storage.from(PRODUCT_BUCKET).upload(path, body, {
        contentType: ct,
        upsert: false,
      })
      if (fb.error) return NextResponse.json({ error: fb.error.message }, { status: 500 })
      const { data } = admin.storage.from(PRODUCT_BUCKET).getPublicUrl(path)
      return NextResponse.json({ url: data.publicUrl, fileName: file.name, contentType: ct })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { data } = admin.storage.from(ORDERS_BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl, fileName: file.name, contentType: ct })
}
