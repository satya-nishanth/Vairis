'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

export type OrderAttachmentItem = {
  id: string
  url: string
  fileName: string
  contentType: string
  /** ISO string from the server. */
  createdAt: string
}

function isPdf(a: OrderAttachmentItem) {
  return a.contentType.includes('pdf') || a.fileName.toLowerCase().endsWith('.pdf')
}

function formatCreatedAt(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Horizontal thumbnail strip for admin order attachments.
 * Click opens an in-page lightbox (image or PDF iframe).
 */
export function OrderAttachmentsGallery({
  attachments,
}: {
  attachments: OrderAttachmentItem[]
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const open = openIndex != null ? attachments[openIndex] : null
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  const close = useCallback(() => setOpenIndex(null), [])

  useEffect(() => {
    if (openIndex == null) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeBtnRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'ArrowRight' && openIndex < attachments.length - 1) {
        setOpenIndex(openIndex + 1)
      }
      if (e.key === 'ArrowLeft' && openIndex > 0) {
        setOpenIndex(openIndex - 1)
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], iframe',
        )
        if (focusable.length === 0) return
        const first = focusable[0]!
        const last = focusable[focusable.length - 1]!
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      previouslyFocused?.focus?.()
    }
  }, [openIndex, attachments.length, close])

  if (attachments.length === 0) return null

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          paddingBottom: 4,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {attachments.map((a, i) => {
          const pdf = isPdf(a)
          const createdLabel = formatCreatedAt(a.createdAt)
          return (
            <div
              key={a.id}
              style={{
                flex: '0 0 auto',
                width: 96,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                title={a.fileName}
                aria-label={`Open ${a.fileName}`}
                style={{
                  width: 96,
                  height: 88,
                  padding: 0,
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {pdf ? (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#6b7280',
                    }}
                  >
                    PDF
                  </span>
                ) : (
                  <img
                    src={a.url}
                    alt={a.fileName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </button>
              <div
                style={{
                  fontSize: '0.6875rem',
                  lineHeight: 1.3,
                  color: '#374151',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  wordBreak: 'break-word',
                }}
                title={a.fileName}
              >
                {a.fileName}
              </div>
              {createdLabel && (
                <div style={{ fontSize: '0.625rem', color: '#9ca3af', lineHeight: 1.25 }}>
                  {createdLabel}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {open && openIndex != null && (
        <div
          role="presentation"
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            // Above admin mobile top bar (z-index 100 in admin-shell.css).
            zIndex: 200,
            background: 'rgba(17, 24, 39, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: 'min(960px, 100%)',
              maxHeight: '90vh',
              width: isPdf(open) ? 'min(900px, 100%)' : 'auto',
              background: '#111827',
              boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 12px',
                background: '#0f172a',
                color: '#e5e7eb',
                fontSize: '0.8125rem',
              }}
            >
              <span
                id={titleId}
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {open.fileName}
                {attachments.length > 1 ? ` · ${openIndex + 1}/${attachments.length}` : ''}
              </span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {attachments.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setOpenIndex(Math.max(0, openIndex - 1))}
                      disabled={openIndex === 0}
                      style={navBtn}
                      aria-label="Previous"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenIndex(Math.min(attachments.length - 1, openIndex + 1))}
                      disabled={openIndex >= attachments.length - 1}
                      style={navBtn}
                      aria-label="Next"
                    >
                      →
                    </button>
                  </>
                )}
                <a
                  href={open.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...navBtn, textDecoration: 'none', display: 'inline-block' }}
                >
                  Open ↗
                </a>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={close}
                  style={navBtn}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              style={{
                maxHeight: 'calc(90vh - 44px)',
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#000',
              }}
            >
              {isPdf(open) ? (
                <iframe
                  src={open.url}
                  title={open.fileName}
                  style={{
                    width: '100%',
                    height: 'min(80vh, 720px)',
                    border: 'none',
                    background: '#fff',
                  }}
                />
              ) : (
                <img
                  src={open.url}
                  alt={open.fileName}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'calc(90vh - 44px)',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const navBtn: React.CSSProperties = {
  border: '1px solid #374151',
  background: '#1f2937',
  color: '#f9fafb',
  padding: '4px 10px',
  fontSize: '0.75rem',
  cursor: 'pointer',
}
