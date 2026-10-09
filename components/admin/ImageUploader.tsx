'use client'
import { useRef, useState } from 'react'
import Image from 'next/image'
import {
  PRODUCT_ANGLE_COUNT,
  PRODUCT_EXTRA_START,
  PRODUCT_VIDEO_SLOT_COUNT,
  isProductVideoUrl,
  normalizeProductImages,
} from '@/lib/product-media'

type Props = {
  images: string[]
  onChange: (images: string[]) => void
}

/** Fixed product views — Front → Left → Right → Back, then up to 3 videos. */
const FIXED_SLOTS = [
  { label: 'Front', hint: 'Front view', accept: 'image/*', index: 0 },
  { label: 'Left', hint: 'Left side', accept: 'image/*', index: 1 },
  { label: 'Right', hint: 'Right side', accept: 'image/*', index: 2 },
  { label: 'Back', hint: 'Back view', accept: 'image/*', index: 3 },
  { label: 'Video 1', hint: 'Video (≤50MB)', accept: 'video/*', index: 4 },
  { label: 'Video 2', hint: 'Optional', accept: 'video/*', index: 5 },
  { label: 'Video 3', hint: 'Optional', accept: 'video/*', index: 6 },
] as const

function isVideoSlot(index: number) {
  return index >= PRODUCT_ANGLE_COUNT && index < PRODUCT_EXTRA_START
}

export default function ImageUploader({ images, onChange }: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const addMoreRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const padded = normalizeProductImages(images)

  const extraIndices = padded
    .map((url, i) => (i >= PRODUCT_EXTRA_START && url ? i : -1))
    .filter((i) => i >= 0)

  function emit(next: string[]) {
    onChange(normalizeProductImages(next))
  }

  async function readUploadError(res: Response): Promise<string> {
    try {
      const json = (await res.json()) as { error?: string }
      if (json?.error) return json.error
    } catch {
      /* non-JSON 500/413 from proxy */
    }
    return `Upload failed (${res.status})`
  }

  async function applyUrl(slotIndex: number, url: string) {
    const next = [...padded]
    while (next.length <= slotIndex) next.push('')
    next[slotIndex] = url
    emit(next)
  }

  /** Azure: browser PUTs bytes to Blob via SAS (never buffers video through the app). */
  async function uploadVideoDirect(file: File, slotIndex: number): Promise<boolean> {
    const metaRes = await fetch('/api/admin/upload/sas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'video/mp4',
        size: file.size,
        folder: 'products',
      }),
    })

    // Local/Supabase — fall back to proxied multipart upload.
    if (metaRes.status === 501) return false

    if (!metaRes.ok) {
      alert(await readUploadError(metaRes))
      return true // handled (failed)
    }

    const meta = (await metaRes.json()) as { uploadUrl?: string; url?: string }
    if (!meta.uploadUrl || !meta.url) {
      alert('Upload failed — no SAS URL returned')
      return true
    }

    setBusy('Uploading video to storage…')
    const put = await fetch(meta.uploadUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'x-ms-blob-content-type': file.type || 'video/mp4',
        'Content-Type': file.type || 'video/mp4',
      },
      body: file,
    })

    if (!put.ok) {
      const text = await put.text().catch(() => '')
      alert(text || `Direct upload failed (${put.status})`)
      return true
    }

    await applyUrl(slotIndex, meta.url)
    return true
  }

  async function uploadFileProxy(file: File, slotIndex: number) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    if (!res.ok) {
      alert(await readUploadError(res))
      return
    }
    const json = (await res.json()) as { url?: string }
    if (!json.url) {
      alert('Upload failed — no URL returned')
      return
    }
    await applyUrl(slotIndex, json.url)
  }

  async function uploadFile(file: File, slotIndex: number) {
    const videoUpload = isVideoSlot(slotIndex) || file.type.startsWith('video/')
    setBusy(videoUpload ? 'Uploading video…' : 'Uploading…')
    try {
      if (videoUpload) {
        const handled = await uploadVideoDirect(file, slotIndex)
        if (handled) return
      }
      await uploadFileProxy(file, slotIndex)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(null)
    }
  }

  async function uploadExtraFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) {
      alert('Please choose image files (jpg, png, webp)')
      return
    }
    setBusy('Uploading…')
    let next = [...padded]
    while (next.length < PRODUCT_EXTRA_START) next.push('')

    try {
      for (const file of list) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          alert(await readUploadError(res))
          break
        }
        const json = (await res.json()) as { url?: string }
        if (!json.url) {
          alert('Upload failed — no URL returned')
          break
        }
        next = [...next, json.url]
      }
      emit(next)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(null)
    }
  }

  function clearSlot(slotIndex: number) {
    if (slotIndex < PRODUCT_EXTRA_START) {
      const next = [...padded]
      while (next.length <= slotIndex) next.push('')
      next[slotIndex] = ''
      emit(next)
      return
    }
    // Extra gallery: remove the slot entirely so indices stay dense after fixed slots
    const next = padded.filter((_, i) => i !== slotIndex)
    emit(next)
  }

  function renderTile(opts: {
    key: string
    label: string
    hint: string
    accept: string
    index: number
    url: string
  }) {
    const { key, label, hint, accept, index, url } = opts
    const filled = !!url

    return (
      <div key={key}>
        <p className="uploader__slot-label">{label}</p>

        <div className="uploader__tile">
          {filled ? (
            <>
              {isProductVideoUrl(url) ? (
                <video src={url} className="uploader__media" muted playsInline />
              ) : (
                <Image src={url} alt={label} fill className="uploader__media" />
              )}
              {isProductVideoUrl(url) && (
                <div className="uploader__play">
                  <span>▶</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => inputRefs.current[index]?.click()}
                className="uploader__replace"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => clearSlot(index)}
                className="uploader__clear"
                aria-label={`Clear ${label}`}
              >
                ×
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => inputRefs.current[index]?.click()}
              className="uploader__empty"
            >
              <span className="uploader__empty-plus">+</span>
              <span className="uploader__empty-hint">{hint}</span>
            </button>
          )}

          <input
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type="file"
            accept={accept}
            className="uploader__input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) uploadFile(file, index)
              e.target.value = ''
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="uploader">
      <div className="uploader__grid">
        {FIXED_SLOTS.map((slot) =>
          renderTile({
            key: slot.label,
            label: slot.label,
            hint: slot.hint,
            accept: slot.accept,
            index: slot.index,
            url: padded[slot.index] ?? '',
          }),
        )}

        {extraIndices.map((index, n) =>
          renderTile({
            key: `extra-${index}`,
            label: `Extra ${n + 1}`,
            hint: 'Extra image',
            accept: 'image/*',
            index,
            url: padded[index] ?? '',
          }),
        )}

        {/* Unlimited add */}
        <div>
          <p className="uploader__slot-label">Add more</p>
          <div className="uploader__tile">
            <button
              type="button"
              onClick={() => addMoreRef.current?.click()}
              className="uploader__empty"
              aria-label="Add more images"
            >
              <span className="uploader__empty-plus">+</span>
              <span className="uploader__empty-hint">More images</span>
            </button>
            <input
              ref={addMoreRef}
              type="file"
              accept="image/*"
              multiple
              className="uploader__input"
              onChange={(e) => {
                if (e.target.files?.length) uploadExtraFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
        </div>
      </div>

      <p className="uploader__note">
        Front → Left → Right → Back required order · Up to {PRODUCT_VIDEO_SLOT_COUNT} videos
        optional · Extra images unlimited (multi-select OK) &nbsp;·&nbsp; Images: jpg · png · webp —
        1200px &nbsp;·&nbsp; Video: mp4 · mov — max 50MB · 720p · 15s
        {busy ? ` · ${busy}` : ''}
      </p>
    </div>
  )
}
