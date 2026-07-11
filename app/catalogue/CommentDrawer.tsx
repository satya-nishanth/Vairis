'use client'

import { useEffect, useRef, useState } from 'react'

type Comment = {
  id: string
  body: string
  username: string
  createdAt: string
}

type Props = {
  productId: string
  guestUsername: string
  onClose: () => void
  onPosted: () => void
}

export default function CommentDrawer({ productId, guestUsername, onClose, onPosted }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/catalogue/comment?productId=${productId}`)
      .then((r) => r.json())
      .then((d) => {
        setComments(d.comments ?? [])
        setLoading(false)
      })
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [productId])

  async function post(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/catalogue/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, body }),
      })
      const data = await res.json()
      if (data.comment) {
        setComments((c) => [...c, data.comment])
        setBody('')
        onPosted()
        setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50)
      }
    } finally {
      setPosting(false)
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] rounded-t-2xl max-h-[70vh] flex flex-col">
        {/* handle */}
        <div className="flex items-center justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 shrink-0">
          <h3 className="text-white font-medium text-sm">Comments</h3>
          <button onClick={onClose} className="text-white/40 text-xl leading-none">×</button>
        </div>

        {/* list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 space-y-4 pb-4">
          {loading && (
            <div className="flex justify-center py-8">
              <span className="text-white/30 text-sm">Loading…</span>
            </div>
          )}
          {!loading && comments.length === 0 && (
            <p className="text-center text-white/30 text-sm py-8">No comments yet. Be the first!</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
                <span className="text-brand-gold text-xs font-medium uppercase">
                  {c.username[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-xs font-medium">@{c.username}</span>
                  <span className="text-white/30 text-[10px]">{formatTime(c.createdAt)}</span>
                </div>
                <p className="text-white/80 text-sm mt-0.5 break-words">{c.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* input */}
        <form onSubmit={post} className="border-t border-white/10 px-4 py-3 flex gap-3 items-center shrink-0">
          <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
            <span className="text-brand-gold text-xs font-medium uppercase">
              {guestUsername[0]}
            </span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 bg-white/5 border border-white/10 text-white placeholder-white/20 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-gold/40"
          />
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="text-brand-gold text-sm font-medium disabled:opacity-30 shrink-0"
          >
            Post
          </button>
        </form>
      </div>
    </>
  )
}
