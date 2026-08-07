'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function SignOutButton() {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={signOut}
      style={{
        fontSize: '0.75rem',
        color: 'var(--color-text-muted)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      Sign Out
    </button>
  )
}
