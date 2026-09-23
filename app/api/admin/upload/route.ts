import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { requireAdmin } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { uploadProductMedia } from '@/lib/azure-blob'

export const dynamic = 'force-dynamic'

// STORAGE_PROVIDER=azure opts into the Azure Blob path (staging, ahead of the
// full Azure migration cutover). Defaults to supabase — unchanged prod/local behavior.
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER ?? 'supabase'

const BUCKET = 'product-media'
const VIDEO_SIZE_LIMIT = 50 * 1024 * 1024 // 50MB — Supabase free tier cap

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
]

async function ensureBucket() {
  const { error } = await getSupabaseAdmin().storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ALLOWED_TYPES,
    fileSizeLimit: VIDEO_SIZE_LIMIT,
  })
  if (error && !error.message.toLowerCase().includes('already exist')) throw error
}

export async function POST(req: NextRequest) {
  await requireAdmin()

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const folder = (formData.get('folder') as string) || 'products'
    const ALLOWED_FOLDERS = ['products', 'quotations/screenshots']
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json({ error: 'Invalid folder' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported type: ${file.type}. Allowed: jpg/png/webp and mp4/webm/mov.` },
        { status: 400 },
      )
    }

    if (STORAGE_PROVIDER !== 'azure') await ensureBucket()

    const isVideo = file.type.startsWith('video/')
    // Node Azure SDK uploadData is reliable with Buffer; undici File.arrayBuffer()
    // alone has caused opaque 500s on larger video payloads in prod.
    const buffer = Buffer.from(await file.arrayBuffer())

    if (isVideo) {
      if (file.size > VIDEO_SIZE_LIMIT) {
        return NextResponse.json(
          { error: 'Video must be under 50MB. Use 720p, max 15 seconds.' },
          { status: 413 },
        )
      }
      const ext = file.name.split('.').pop() ?? 'mp4'
      const path = `${folder}/videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      if (STORAGE_PROVIDER === 'azure') {
        const url = await uploadProductMedia(path, buffer, file.type)
        return NextResponse.json({ url, type: 'video' })
      }
      const { error } = await getSupabaseAdmin().storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: file.type, upsert: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const { data } = getSupabaseAdmin().storage.from(BUCKET).getPublicUrl(path)
      return NextResponse.json({ url: data.publicUrl, type: 'video' })
    }

    // Image — resize with Sharp, always output JPEG
    const resized = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()

    const path = `${folder}/images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

    if (STORAGE_PROVIDER === 'azure') {
      const url = await uploadProductMedia(path, resized, 'image/jpeg')
      return NextResponse.json({ url, type: 'image' })
    }
    const { error } = await getSupabaseAdmin().storage
      .from(BUCKET)
      .upload(path, resized, { contentType: 'image/jpeg', upsert: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data } = getSupabaseAdmin().storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, type: 'image' })
  } catch (err) {
    console.error('[admin.upload]', err)
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { 'x-vairis-upload': 'proxy-v2' } },
    )
  }
}
