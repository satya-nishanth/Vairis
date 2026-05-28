'use client'

import { useEffect, useRef, useState } from 'react'
import { IconChevronRight } from '@/components/catalogue/CatalogueIcons'

type Props = {
  productId: string
  guestUsername: string
  onPosted: () => void
  onComplete: () => void
  visible: boolean
  isActive: boolean
}

export default function InlineComment({
  productId,
  guestUsername,
  onPosted,
  onComplete,
  visible,
  isActive,
}: Props) {
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [entered, setEntered] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!visible || !isActive) {
      setEntered(false)
      return
    }
    const t = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(t)
  }, [visible, isActive])

  useEffect(() => {
    if (!visible || !isActive) return
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (coarse) return
    const t = setTimeout(() => inputRef.current?.focus(), 200)
    return () => clearTimeout(t)
  }, [visible, isActive])

  async function handleContinue(e?: React.SyntheticEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    if (posting) return

    const text = body.trim()
    if (!text) {
      onComplete()
      return
    }

    setPosting(true)
    setError(null)
    try {
      const res = await fetch('/api/catalogue/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, body: text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[InlineComment] post failed', res.status, data)
        setError('Failed to send. Try again.')
        return
      }
      const data = await res.json()
      if (data.comment) {
        setBody('')
        onPosted()
      }
      onComplete()
    } catch (err) {
      console.error('[InlineComment] network error', err)
      setError('No connection. Try again.')
    } finally {
      setPosting(false)
    }
  }

  if (!isActive || !visible) return null

  const hasText = body.trim().length > 0
  const cta = posting ? '…' : hasText ? 'Send' : 'Continue'

  return (
    <div
      className={`relative z-[60] mt-4 pointer-events-auto transition-all duration-300 ease-out ${
        entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="text-[10px] text-brand-gold/80 tracking-[0.2em] uppercase mb-2 pl-0.5">
        One more step · swipe up after this
      </p>
      {error && (
        <p className="text-[10px] text-red-400 mb-1 pl-0.5">{error}</p>
      )}

      <form
        onSubmit={handleContinue}
        onPointerDown={(e) => e.stopPropagation()}
        className="relative z-[60] rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-2 mr-14 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-brand-gold/15 border border-brand-gold/25 flex items-center justify-center shrink-0">
            <span className="text-brand-gold text-[11px] font-semibold uppercase">
              {guestUsername[0]}
            </span>
          </div>

          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            enterKeyHint="done"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleContinue(e)
              }
            }}
            placeholder="Your note (optional)"
            className="flex-1 min-w-0 bg-transparent text-white placeholder-white/30 px-1 py-2.5 text-[16px] focus:outline-none"
            style={{ fontSize: '16px' }}
          />

          <button
            type="button"
            disabled={posting}
            onClick={handleContinue}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={hasText ? 'Send note and continue' : 'Continue without note'}
            className="relative z-[61] shrink-0 inline-flex items-center justify-center gap-1 h-11 min-w-[6.5rem] px-4 rounded-full bg-brand-gold text-brand-dark text-xs font-semibold tracking-wide uppercase disabled:opacity-60 active:scale-[0.97] transition touch-manipulation shadow-lg shadow-brand-gold/20"
          >
            <span className="pointer-events-none select-none">{cta}</span>
            {!posting && (
              <IconChevronRight className="w-3.5 h-3.5 pointer-events-none shrink-0 select-none" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
