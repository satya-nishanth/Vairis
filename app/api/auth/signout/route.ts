import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true, message: 'Logged out successfully' })
  } catch (err) {
    console.error('[POST /api/auth/signout] error:', err)
    return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 })
  }
}
