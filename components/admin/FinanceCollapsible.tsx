'use client'

import { useEffect, useId, useState } from 'react'

const GREEN = '#032b24'

/** Collapsible panel — collapsed by default; expand when `forceOpen` (e.g. editing). */
export function FinanceCollapsible({
  title,
  subtitle,
  forceOpen = false,
  highlight = false,
  showPlus = false,
  children,
}: {
  title: string
  subtitle?: string
  forceOpen?: boolean
  /** Brand-tinted header for primary actions (e.g. Record transaction). */
  highlight?: boolean
  showPlus?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(!!forceOpen)
  const panelId = useId()

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  function toggle() {
    setOpen((v) => !v)
  }

  return (
    <div
      style={{
        background: highlight ? '#f3f8f6' : '#fff',
        border: highlight ? `1.5px solid ${GREEN}` : '1px solid #e5e7eb',
        borderRadius: 12,
        marginBottom: 20,
        boxShadow: highlight
          ? '0 2px 8px rgba(3, 43, 36, 0.08)'
          : '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 20px',
          minHeight: 52,
          background: highlight ? 'rgba(3, 43, 36, 0.04)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          WebkitTapHighlightColor: 'rgba(3, 43, 36, 0.12)',
          touchAction: 'manipulation',
          appearance: 'none',
          WebkitAppearance: 'none',
          color: 'inherit',
          font: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none', minWidth: 0 }}>
          {showPlus && (
            <span
              aria-hidden
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: GREEN,
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 600,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              +
            </span>
          )}
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: highlight ? GREEN : '#111827',
                lineHeight: 1.3,
              }}
            >
              {title}
            </span>
            {subtitle && open && (
              <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: '#6b7280', lineHeight: 1.4 }}>
                {subtitle}
              </span>
            )}
          </span>
        </span>
        <span
          aria-hidden
          style={{
            color: highlight ? GREEN : '#9ca3af',
            fontSize: '0.75rem',
            pointerEvents: 'none',
            flexShrink: 0,
          }}
        >
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <div id={panelId} style={{ padding: '0 20px 20px' }}>
          {children}
        </div>
      ) : null}
    </div>
  )
}
