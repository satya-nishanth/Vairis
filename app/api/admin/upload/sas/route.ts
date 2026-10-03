import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createProductMediaUploadTarget } from '@/lib/azure-blob'

export const dynamic = 'force-dynamic'

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER ?? 'supabase'
const VIDEO_SIZE_LIMIT = 50 * 1024 * 1024

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
]

const ALLOWED_FOLDERS = ['products', 'collections', 'quotations/screenshots']

/** Mint a short-lived Azure Blob SAS so the browser can PUT video bytes directly. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    if (STORAGE_PROVIDER !== 'azure') {
      return NextResponse.json(
        { error: 'Direct upload is only available when STORAGE_PROVIDER=azure', code: 'NOT_AZURE' },
        { status: 501, headers: { 'x-vairis-upload': 'sas-unavailable' } },
      )
    }

    const body = (await req.json().catch(() => null)) as {
      filename?: string
      contentType?: string
      size?: number
      folder?: string
    } | null

    const filename = String(body?.filename ?? '').trim()
    const contentType = String(body?.contentType ?? '').trim()
    const size = Number(body?.size ?? 0)
    const folder = String(body?.folder ?? 'products').trim() || 'products'

    if (!filename) {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 })
    }
    if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: `Unsupported type: ${contentType || '(empty)'}. Allowed: mp4/webm/mov.` },
        { status: 400 },
      )
    }
    if (!(size > 0) || size > VIDEO_SIZE_LIMIT) {
      return NextResponse.json(
        { error: 'Video must be under 50MB. Use 720p, max 15 seconds.' },
        { status: 413 },
      )
    }
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json({ error: 'Invalid folder' }, { status: 400 })
    }

    const ext = filename.split('.').pop()?.toLowerCase() || 'mp4'
    const path = `${folder}/videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const target = await createProductMediaUploadTarget(path, contentType)

    return NextResponse.json(
      {
        uploadUrl: target.uploadUrl,
        url: target.publicUrl,
        type: 'video' as const,
        path,
      },
      { headers: { 'x-vairis-upload': 'sas-v1' } },
    )
  } catch (err) {
    console.error('[admin.upload.sas]', err)
    const message = err instanceof Error ? err.message : 'Failed to create upload URL'
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { 'x-vairis-upload': 'sas-error' } },
    )
  }
}
