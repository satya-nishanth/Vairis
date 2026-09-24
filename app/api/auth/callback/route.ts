import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { sanitizeRedirect } from '@/lib/auth/safe-redirect'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  // Not request.url's origin — behind Azure Container Apps' proxy this
  // resolves to the container's internal bind address (0.0.0.0:3000, see
  // Dockerfile HOSTNAME/PORT) rather than the public host, sending users
  // to an unreachable URL after login.
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const code = searchParams.get('code')
  const next = sanitizeRedirect(searchParams.get('next'), '/')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(errorDescription ?? error)}`
    )
  }

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent(exchangeError.message)}`
      )
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await prisma.user.upsert({
        where: { email: session.user.email! },
        update: { googleId: session.user.id },
        create: {
          email: session.user.email!,
          name: session.user.user_metadata?.full_name ?? session.user.email!,
          googleId: session.user.id,
        },
      })
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
