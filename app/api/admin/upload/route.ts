import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BUCKET = 'product-images'

async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 10 * 1024 * 1024,
  })
  // Ignore "already exists" error
  if (error && !error.message.toLowerCase().includes('already exist')) {
    throw error
  }
}

export async function POST(req: NextRequest) {
  await requireAdmin()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  await ensureBucket()

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
