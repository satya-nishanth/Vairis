import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'product-media'
const VIDEO_SIZE_LIMIT = 50 * 1024 * 1024 // 50MB — Supabase free tier cap

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
]

async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ALLOWED_TYPES,
    fileSizeLimit: VIDEO_SIZE_LIMIT,
  })
  if (error && !error.message.toLowerCase().includes('already exist')) throw error
}

export async function POST(req: NextRequest) {
  await requireAdmin()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported type: ${file.type}. Allowed: jpg/png/webp and mp4/webm/mov.` },
      { status: 400 }
    )
  }

  await ensureBucket()

  const isVideo = file.type.startsWith('video/')
  const arrayBuffer = await file.arrayBuffer()

  if (isVideo) {
    if (file.size > VIDEO_SIZE_LIMIT) {
      return NextResponse.json(
        { error: 'Video must be under 50MB. Use 720p, max 15 seconds.' },
        { status: 413 }
      )
    }
    const ext = file.name.split('.').pop() ?? 'mp4'
    const path = `products/videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, type: 'video' })
  }

  // Image — resize with Sharp, always output JPEG
  const buffer = Buffer.from(arrayBuffer)
  const resized = await sharp(buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  const path = `products/images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, resized, { contentType: 'image/jpeg', upsert: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl, type: 'image' })
}
