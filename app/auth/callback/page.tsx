import { createServerSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  const supabase = await createServerSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

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

  redirect(params.next ?? '/')
}
