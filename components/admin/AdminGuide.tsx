'use client'

import { useEffect, useState } from 'react'

type AdminGuideProps = {
  pageKey: string
  title: string
  blurb: string
  tips?: string[]
}

export function AdminGuide({ pageKey, title, blurb, tips }: AdminGuideProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // SSR renders expanded; syncing from localStorage post-mount is the
    // hydration-safe pattern (a lazy initializer would mismatch the server HTML)
    if (localStorage.getItem(`admin-guide:${pageKey}`) === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(true)
    }
  }, [pageKey])

  function toggle() {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(`admin-guide:${pageKey}`, next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="admin-guide">
      <button type="button" className="admin-guide__head" onClick={toggle} aria-expanded={!collapsed}>
        <span>
          <span className="admin-guide__eyebrow">Guide</span>
          <span className="admin-guide__title">{title}</span>
        </span>
        <span className="admin-guide__toggle" aria-hidden="true">{collapsed ? '▾' : '▴'}</span>
      </button>
      {!collapsed && (
        <div className="admin-guide__body">
          <p style={{ margin: 0 }}>{blurb}</p>
          {tips && tips.length > 0 && (
            <ul className="admin-guide__tips">
              {tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
