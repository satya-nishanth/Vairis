'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeIcon } from '@/components/icons/ThemeIcon'

export function SearchBar({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        maxWidth: '540px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--color-border, #d1d5db)',
          borderRadius: '8px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        }}
      >
        <span style={{ color: 'var(--color-text-muted, #9ca3af)', display: 'flex', alignItems: 'center' }}>
          <ThemeIcon name="search" category="navigation" size={18} />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by piece, style, category, or code..."
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '0.9375rem',
            background: 'transparent',
            color: 'var(--color-text, #111827)',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted, #9ca3af)',
              padding: '2px',
              fontSize: '16px',
              lineHeight: 1,
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <button
        type="submit"
        disabled={!query.trim()}
        className="btn btn-primary"
        style={{
          padding: '11px 22px',
          fontSize: '0.875rem',
          fontWeight: 600,
          borderRadius: '8px',
          cursor: query.trim() ? 'pointer' : 'default',
          flexShrink: 0,
        }}
      >
        Search
      </button>
    </form>
  )
}
