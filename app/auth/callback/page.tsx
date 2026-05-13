import { createServerSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string; error?: string; error_description?: string }>
}) {
  const { code, next, error, error_description } = await searchParams

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error_description ?? error)}`)
  }

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      redirect(`/auth/login?error=${encodeURIComponent(exchangeError.message)}`)
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

  redirect(next ?? '/')
}
