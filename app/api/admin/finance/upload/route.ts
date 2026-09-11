import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { requireFinanceApi } from '@/lib/finance-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { uploadProductMedia } from '@/lib/azure-blob'

export const dynamic = 'force-dynamic'

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER ?? 'supabase'
const PRODUCT_BUCKET = 'product-media'
/** Dedicated bucket so PDF isn't blocked by product-media image/video allowlist. */
const FINANCE_BUCKET = 'finance-attachments'
const SIZE_LIMIT = 20 * 1024 * 1024

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]

async function ensureFinanceBucket() {
  const admin = getSupabaseAdmin()
  const { data: buckets } = await admin.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === FINANCE_BUCKET)
  if (exists) {
    await admin.storage.updateBucket(FINANCE_BUCKET, {
      public: true,
      allowedMimeTypes: ALLOWED_TYPES,
      fileSizeLimit: SIZE_LIMIT,
    })
    return
  }
  const { error } = await admin.storage.createBucket(FINANCE_BUCKET, {
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

export async function POST(req: NextRequest) {
  const gate = await requireFinanceApi()
  if (gate.error) return gate.error

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

  const arrayBuffer = await file.arrayBuffer()
  const isPdf = contentType === 'application/pdf'
  const ext = isPdf ? 'pdf' : 'jpg'
  const path = `bills/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  if (STORAGE_PROVIDER === 'azure') {
    const body = isPdf
      ? arrayBuffer
      : await sharp(Buffer.from(arrayBuffer))
          .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()
    const ct = isPdf ? contentType : 'image/jpeg'
    const url = await uploadProductMedia(`finance/${path}`, body, ct)
    return NextResponse.json({ url, fileName: file.name, contentType: ct })
  }

  await ensureFinanceBucket()

  const body = isPdf
    ? arrayBuffer
    : await sharp(Buffer.from(arrayBuffer))
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
  const ct = isPdf ? contentType : 'image/jpeg'

  const { error } = await getSupabaseAdmin().storage
    .from(FINANCE_BUCKET)
    .upload(path, body, { contentType: ct, upsert: false })
  if (error) {
    // Fallback: try product-media if finance bucket create was blocked
    const { error: fallbackError } = await getSupabaseAdmin().storage
      .from(PRODUCT_BUCKET)
      .upload(`finance/${path}`, body, { contentType: ct, upsert: false })
    if (fallbackError) {
      return NextResponse.json({ error: fallbackError.message || error.message }, { status: 500 })
    }
    const { data } = getSupabaseAdmin().storage.from(PRODUCT_BUCKET).getPublicUrl(`finance/${path}`)
    return NextResponse.json({ url: data.publicUrl, fileName: file.name, contentType: ct })
  }

  const { data } = getSupabaseAdmin().storage.from(FINANCE_BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl, fileName: file.name, contentType: ct })
}
