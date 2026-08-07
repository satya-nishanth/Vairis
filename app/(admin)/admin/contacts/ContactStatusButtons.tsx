'use client'

import { useRouter } from 'next/navigation'

export function ContactStatusButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter()

  async function setStatus(next: 'RESPONDED' | 'CLOSED') {
    await fetch(`/api/admin/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    router.refresh()
  }

  if (status === 'CLOSED') return null
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {status === 'NEW' && (
        <button
          type="button"
          onClick={() => setStatus('RESPONDED')}
          style={{ background: 'none', border: 'none', color: '#b8963e', cursor: 'pointer', fontSize: '0.8125rem', padding: 0 }}
        >
          Mark responded
        </button>
      )}
      <button
        type="button"
        onClick={() => setStatus('CLOSED')}
        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.8125rem', padding: 0 }}
      >
        Close
      </button>
    </div>
  )
}
