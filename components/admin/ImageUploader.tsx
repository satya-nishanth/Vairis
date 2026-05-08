'use client'
import { useState, useRef } from 'react'
import Image from 'next/image'

type Props = {
  images: string[]
  onChange: (images: string[]) => void
}

function isVideo(url: string) {
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url)
}

export default function ImageUploader({ images, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList) {
    setError('')
    setUploading(true)
    const uploaded: string[] = []

    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Upload failed')
        break
      }
      uploaded.push(json.url)
    }

    setUploading(false)
    if (uploaded.length) onChange([...images, ...uploaded])
  }

  function removeMedia(url: string) {
    onChange(images.filter((i) => i !== url))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((url) => (
          <div key={url} className="relative w-24 h-24 group flex-shrink-0">
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
                alt=""
                fill
                className="object-cover rounded border border-gray-200"
              />
            )}
            {isVideo(url) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs">▶</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => removeMedia(url)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-24 h-24 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {uploading ? (
            <span className="text-xs text-center px-1">Uploading…</span>
          ) : (
            <>
              <span className="text-2xl leading-none">+</span>
              <span className="text-[10px] mt-1 text-center leading-tight">Photo or Video</span>
            </>
          )}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-[10px] text-gray-400">jpg · png · webp · mp4 · webm · mov — max 200 MB</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/x-msvideo"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  )
}
