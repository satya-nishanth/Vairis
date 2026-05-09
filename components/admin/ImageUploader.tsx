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
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-3">
        {SLOTS.map((slot) => {
          const url = images[slot.index] ?? ''
          const filled = !!url

          return (
            <div key={slot.label} className="space-y-1">
              <p className="text-[10px] text-gray-500 tracking-widest uppercase text-center">
                {slot.label}
              </p>

              <div className="relative aspect-square group">
                {filled ? (
                  <>
                    {isVideo(url) ? (
                      <video
                        src={url}
                        className="w-full h-full object-cover rounded border border-gray-200"
                        muted
                        playsInline
                      />
                    ) : (
                      <Image
                        src={url}
                        alt={slot.label}
                        fill
                        className="object-cover rounded border border-gray-200"
                      />
                    )}
                    {isVideo(url) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px]">▶</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => inputRefs.current[slot.index]?.click()}
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity rounded flex items-center justify-center"
                    >
                      <span className="text-white text-xs font-medium">Replace</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => clearSlot(slot.index)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputRefs.current[slot.index]?.click()}
                    className="w-full h-full border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-colors"
                  >
                    <span className="text-xl leading-none">+</span>
                    <span className="text-[9px] mt-1 text-center leading-tight px-1">{slot.hint}</span>
                  </button>
                )}

                <input
                  ref={(el) => { inputRefs.current[slot.index] = el }}
                  type="file"
                  accept={slot.accept}
                  className="hidden"
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

      <p className="text-[10px] text-gray-400">
        Images: jpg · png · webp — auto-resized to 1200px &nbsp;·&nbsp; Video: mp4 · mov — max 50MB · 720p · 15s
      </p>
    </div>
  )
}
