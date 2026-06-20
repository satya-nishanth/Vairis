'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Icon } from '@iconify/react'
import IconButton from '@/components/admin/IconButton'
import HeroPreviewDropdown from '@/components/admin/HeroPreviewDropdown'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { MAX_HERO_IMAGES, type HeroImageRecord } from '@/lib/hero-images'

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { error: 'Invalid server response' }
  }
}

function errorMessage(data: unknown, fallback: string) {
  return data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
    ? data.error
    : fallback
}

function DragHandle() {
  return <Icon icon="carbon:draggable" width={16} height={16} className="text-gray-300" aria-hidden />
}

type SlideRow = HeroImageRecord | null

export default function HeroImageManager() {
  const [images, setImages] = useState<HeroImageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<HeroImageRecord | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const replaceTargetRef = useRef<string | null>(null)
  const dragIdRef = useRef<string | null>(null)

  const slotsLeft = MAX_HERO_IMAGES - images.length
  const canAdd = slotsLeft > 0

  const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder)
  const rows: SlideRow[] = [
    ...sortedImages,
    ...Array.from({ length: slotsLeft }, () => null),
  ]

  const loadImages = useCallback(async () => {
    const res = await fetch('/api/admin/hero-images')
    const data = await parseJson(res)
    if (!res.ok) {
      alert(errorMessage(data, 'Failed to load hero images'))
      return
    }
    if (Array.isArray(data)) setImages(data as HeroImageRecord[])
  }, [])

  useEffect(() => {
    loadImages().finally(() => setLoading(false))
  }, [loadImages])

  async function uploadFile(file: File): Promise<string | null> {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    const json = await parseJson(res)
    if (!res.ok) {
      alert(errorMessage(json, 'Upload failed'))
      return null
    }
    return (json as { url: string }).url
  }

  async function handleAdd(file: File) {
    if (!canAdd) return
    setBusy(true)
    try {
      const url = await uploadFile(file)
      if (!url) return

      const res = await fetch('/api/admin/hero-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await parseJson(res)
      if (!res.ok) {
        alert(errorMessage(data, 'Failed to save hero image'))
        return
      }
      setImages((prev) => [...prev, data as HeroImageRecord].sort((a, b) => a.sortOrder - b.sortOrder))
    } finally {
      setBusy(false)
    }
  }

  async function handleReplace(id: string, file: File) {
    setBusy(true)
    try {
      const url = await uploadFile(file)
      if (!url) return

      const res = await fetch(`/api/admin/hero-images/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await parseJson(res)
      if (!res.ok) {
        alert(errorMessage(data, 'Failed to replace image'))
        return
      }
      setImages((prev) => prev.map((img) => (img.id === id ? (data as HeroImageRecord) : img)))
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/hero-images/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      const data = await parseJson(res)
      if (!res.ok) {
        alert(errorMessage(data, 'Failed to update status'))
        return
      }
      setImages((prev) => prev.map((img) => (img.id === id ? (data as HeroImageRecord) : img)))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/hero-images/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await parseJson(res)
        alert(errorMessage(data, 'Failed to delete'))
        return
      }
      setImages((prev) => prev.filter((img) => img.id !== id))
      setDeleteTarget(null)
    } finally {
      setBusy(false)
    }
  }

  async function persistOrder(next: HeroImageRecord[]) {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/hero-images/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map((img) => img.id) }),
      })
      const data = await parseJson(res)
      if (!res.ok) {
        alert(errorMessage(data, 'Failed to reorder'))
        await loadImages()
        return
      }
      if (Array.isArray(data)) setImages(data as HeroImageRecord[])
    } finally {
      setBusy(false)
    }
  }

  function applyReorder(next: HeroImageRecord[]) {
    setImages(next)
    void persistOrder(next)
  }

  function clearDrag() {
    dragIdRef.current = null
    setDragId(null)
    setDragOverId(null)
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    dragIdRef.current = id
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  function getDraggedId(e: React.DragEvent) {
    return e.dataTransfer.getData('text/plain') || dragIdRef.current
  }

  function reorder(draggedId: string, targetId: string) {
    if (draggedId === targetId) return

    const next = [...images].sort((a, b) => a.sortOrder - b.sortOrder)
    const from = next.findIndex((img) => img.id === draggedId)
    const to = next.findIndex((img) => img.id === targetId)
    if (from < 0 || to < 0) return

    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    applyReorder(next)
  }

  function reorderToSlot(draggedId: string, slotIndex: number) {
    const next = [...images].sort((a, b) => a.sortOrder - b.sortOrder)
    const from = next.findIndex((img) => img.id === draggedId)
    if (from < 0) return

    const [moved] = next.splice(from, 1)
    const insertAt = Math.min(slotIndex, next.length)
    next.splice(insertAt, 0, moved)
    applyReorder(next)
  }

  function onDropFiles(e: React.DragEvent) {
    if (dragIdRef.current) return
    e.preventDefault()
    setDropActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) void handleAdd(file)
  }

  function EmptySlot({ slotIndex }: { slotIndex: number }) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!dragIdRef.current && e.dataTransfer.types.includes('Files')) {
            setDropActive(true)
          }
        }}
        onDragLeave={(e) => {
          e.stopPropagation()
          setDropActive(false)
        }}
        onDrop={(e) => {
          e.stopPropagation()
          onDropFiles(e)
        }}
        className={`h-full w-full rounded-lg border-2 border-dashed flex items-center justify-center gap-3 transition-colors disabled:opacity-50 ${
          dropActive
            ? 'border-brand-gold bg-brand-gold/5'
            : 'border-gray-200 hover:border-brand-gold/50 hover:bg-brand-cream/40'
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center shrink-0">
          <Icon icon="carbon:cloud-upload" width={20} height={20} />
        </div>
        <div className="text-left">
          <p className="text-xs font-medium text-gray-500">Slot {slotIndex + 1} — click or drop to upload</p>
          <p className="text-[10px] text-gray-400">New slides are active by default · JPG · PNG · WebP</p>
        </div>
      </button>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-white border border-gray-100 rounded-lg overflow-hidden">
        <div className="shrink-0 px-4 py-3 border-b border-gray-50">
          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-gold/30 border-t-brand-gold rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-col flex-1 min-h-0 bg-white border border-gray-100 rounded-lg overflow-hidden min-w-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 shrink-0 gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-gray-900">Hero banner slides</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {images.length}/{MAX_HERO_IMAGES} slots · use the ⋮⋮ handle to drag and reorder
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {busy && (
            <span className="text-[10px] text-brand-gold tracking-widest uppercase animate-pulse">Saving…</span>
          )}
          <HeroPreviewDropdown />
        </div>
      </div>

      <ul className="flex flex-col gap-2 p-3 overflow-y-auto flex-1 min-h-0">
          {rows.map((img, index) => {
            if (!img) {
              return (
                <li
                  key={`empty-${index}`}
                  className={`h-44 shrink-0 ${dragOverId === `empty-${index}` ? 'ring-2 ring-brand-gold/30 rounded-lg' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragIdRef.current) setDragOverId(`empty-${index}`)
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverId(null)
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = getDraggedId(e)
                    if (id) reorderToSlot(id, index)
                    clearDrag()
                  }}
                >
                  <EmptySlot slotIndex={index} />
                </li>
              )
            }

            const isDragging = dragId === img.id
            const isOver = dragOverId === img.id && dragId !== img.id

            return (
              <li
                key={img.id}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragIdRef.current && dragIdRef.current !== img.id) {
                    setDragOverId(img.id)
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverId(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = getDraggedId(e)
                  if (id && id !== img.id) reorder(id, img.id)
                  clearDrag()
                }}
                className={`h-44 shrink-0 rounded-lg border transition-all overflow-hidden ${
                  isDragging ? 'opacity-40 border-brand-gold' : 'border-gray-100'
                } ${isOver ? 'ring-2 ring-brand-gold/30 border-brand-gold/40' : ''}`}
              >
                <div className="flex items-stretch h-44">
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, img.id)}
                    onDragEnd={clearDrag}
                    className="flex items-center justify-center w-10 shrink-0 border-r border-gray-100 bg-white cursor-grab active:cursor-grabbing touch-none"
                    title="Drag to reorder"
                  >
                    <DragHandle />
                  </div>

                  <div className="relative flex-1 min-w-[240px] h-full bg-brand-cream select-none">
                    <Image
                      src={img.url}
                      alt={`Hero slide ${index + 1}`}
                      fill
                      draggable={false}
                      className={`object-cover pointer-events-none ${!img.isActive ? 'grayscale-[50%] brightness-90' : ''}`}
                      sizes="(max-width: 768px) 100vw, 640px"
                    />
                    <span className="absolute top-1.5 left-1.5 bg-brand-dark/80 text-white text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded">
                      Slide {index + 1}
                    </span>
                    {img.isActive ? (
                      <span className="absolute top-1.5 right-1.5 bg-green-700/85 text-white text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="absolute top-1.5 right-1.5 bg-gray-900/80 text-white text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-1 px-2 border-l border-gray-100 bg-white shrink-0"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {img.isActive ? (
                      <IconButton
                        icon="carbon:view-off"
                        label="Deactivate"
                        onClick={() => toggleActive(img.id, false)}
                        disabled={busy}
                      />
                    ) : (
                      <IconButton
                        icon="carbon:view"
                        label="Activate"
                        onClick={() => toggleActive(img.id, true)}
                        disabled={busy}
                        variant="success"
                      />
                    )}
                    <IconButton
                      icon="carbon:renew"
                      label="Replace image"
                      onClick={() => {
                        replaceTargetRef.current = img.id
                        replaceInputRef.current?.click()
                      }}
                      disabled={busy}
                      variant="gold"
                    />
                    <IconButton
                      icon="carbon:trash-can"
                      label="Delete slide"
                      onClick={() => setDeleteTarget(img)}
                      disabled={busy}
                      variant="danger"
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleAdd(file)
          e.target.value = ''
        }}
      />

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          const id = replaceTargetRef.current
          if (file && id) void handleReplace(id, file)
          replaceTargetRef.current = null
          e.target.value = ''
        }}
      />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete hero slide?"
        message="This slide will be removed from the banner. You can upload a new image to fill the slot."
        confirmLabel="Delete slide"
        onConfirm={() => deleteTarget && void handleDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        loading={busy}
      />
    </div>
  )
}
