'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'

export default function HeroPreviewDropdown() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Preview banner"
        aria-label="Preview banner"
        aria-expanded={open}
        className={`p-2 rounded border transition-colors ${
          open
            ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
            : 'border-gray-200 text-gray-500 hover:border-brand-gold/50 hover:text-brand-gold hover:bg-brand-cream/50'
        }`}
      >
        <Icon icon="carbon:image" width={18} height={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-44 bg-white border border-gray-100 rounded-lg shadow-xl overflow-hidden py-1">
          <Link
            href="/admin/hero-images/preview/mobile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-cream/60 hover:text-brand-gold transition-colors"
          >
            <Icon icon="carbon:mobile" width={16} height={16} />
            Mobile view
          </Link>
          <Link
            href="/admin/hero-images/preview/web"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-cream/60 hover:text-brand-gold transition-colors"
          >
            <Icon icon="carbon:laptop" width={16} height={16} />
            Web view
          </Link>
        </div>
      )}
    </div>
  )
}
