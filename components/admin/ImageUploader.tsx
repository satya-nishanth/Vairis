'use client'
import { useRef } from 'react'
import Image from 'next/image'

type Props = {
  images: string[]
  onChange: (images: string[]) => void
}

/** Fixed product views — Front → Left → Right → Back, then Video. */
const FIXED_SLOTS = [
  { label: 'Front', hint: 'Front view', accept: 'image/*', index: 0 },
  { label: 'Left', hint: 'Left side', accept: 'image/*', index: 1 },
  { label: 'Right', hint: 'Right side', accept: 'image/*', index: 2 },
  { label: 'Back', hint: 'Back view', accept: 'image/*', index: 3 },
  { label: 'Video', hint: 'Video (≤50MB)', accept: 'video/*', index: 4 },
] as const

const EXTRA_START = 5

function isVideo(url: string) {
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url)
}

export default function ImageUploader({ images, onChange }: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const addMoreRef = useRef<HTMLInputElement | null>(null)

  // Ensure array is long enough for fixed slots when reading
  const padded = [...images]
  while (padded.length < EXTRA_START) padded.push('')

  const extraIndices = padded
    .map((url, i) => (i >= EXTRA_START && url ? i : -1))
    .filter((i) => i >= 0)

  async function uploadFile(file: File, slotIndex: number) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? 'Upload failed')
      return
    }
    const next = [...images]
    while (next.length <= slotIndex) next.push('')
    next[slotIndex] = json.url
    onChange(next)
  }

  async function uploadExtraFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) {
      alert('Please choose image files (jpg, png, webp)')
      return
    }
    let next = [...images]
    while (next.length < EXTRA_START) next.push('')

    for (const file of list) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? 'Upload failed')
        break
      }
      next = [...next, json.url]
    }
    onChange(next)
  }

  function clearSlot(slotIndex: number) {
    if (slotIndex < EXTRA_START) {
      const next = [...images]
      while (next.length <= slotIndex) next.push('')
      next[slotIndex] = ''
      onChange(next)
      return
    }
    // Extra gallery: remove the slot entirely so indices stay dense after fixed slots
    const next = images.filter((_, i) => i !== slotIndex)
    onChange(next)
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
              {isVideo(url) ? (
                <video src={url} className="uploader__media" muted playsInline />
              ) : (
                <Image src={url} alt={label} fill className="uploader__media" />
              )}
              {isVideo(url) && (
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
        Front → Left → Right → Back required order · Video optional · Extra images unlimited
        (multi-select OK) &nbsp;·&nbsp; Images: jpg · png · webp — 1200px &nbsp;·&nbsp; Video: mp4 ·
        mov — max 50MB · 720p · 15s
      </p>
    </div>
  )
}
