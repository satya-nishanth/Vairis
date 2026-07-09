'use client'
import { useRef } from 'react'
import Image from 'next/image'

type Props = {
  images: string[]
  onChange: (images: string[]) => void
}

const SLOTS = [
  { label: 'Front', hint: 'Front view', accept: 'image/*', index: 0 },
  { label: 'Left', hint: 'Left side', accept: 'image/*', index: 1 },
  { label: 'Right', hint: 'Right side', accept: 'image/*', index: 2 },
  { label: 'Back', hint: 'Back view', accept: 'image/*', index: 3 },
  { label: 'Video', hint: 'Video (≤50MB)', accept: 'video/*', index: 4 },
]

function isVideo(url: string) {
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url)
}

export default function ImageUploader({ images, onChange }: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

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
    next[slotIndex] = json.url
    onChange(next)
  }

  function clearSlot(slotIndex: number) {
    const next = [...images]
    next[slotIndex] = ''
    onChange(next)
  }

  return (
    <div className="uploader">
      <div className="uploader__grid">
        {SLOTS.map((slot) => {
          const url = images[slot.index] ?? ''
          const filled = !!url

          return (
            <div key={slot.label}>
              <p className="uploader__slot-label">{slot.label}</p>

              <div className="uploader__tile">
                {filled ? (
                  <>
                    {isVideo(url) ? (
                      <video src={url} className="uploader__media" muted playsInline />
                    ) : (
                      <Image src={url} alt={slot.label} fill className="uploader__media" />
                    )}
                    {isVideo(url) && (
                      <div className="uploader__play">
                        <span>▶</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => inputRefs.current[slot.index]?.click()}
                      className="uploader__replace"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => clearSlot(slot.index)}
                      className="uploader__clear"
                      aria-label={`Clear ${slot.label}`}
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputRefs.current[slot.index]?.click()}
                    className="uploader__empty"
                  >
                    <span className="uploader__empty-plus">+</span>
                    <span className="uploader__empty-hint">{slot.hint}</span>
                  </button>
                )}

                <input
                  ref={(el) => { inputRefs.current[slot.index] = el }}
                  type="file"
                  accept={slot.accept}
                  className="uploader__input"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadFile(file, slot.index)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="uploader__note">
        Images: jpg · png · webp — auto-resized to 1200px &nbsp;·&nbsp; Video: mp4 · mov — max 50MB · 720p · 15s
      </p>
    </div>
  )
}
