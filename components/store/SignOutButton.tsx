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
      className="text-xs text-gray-400 hover:text-red-400 transition-colors tracking-widest uppercase"
    >
      Sign Out
    </button>
  )
}
