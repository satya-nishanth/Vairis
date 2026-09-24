import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const isProd = process.env.NODE_ENV === 'production'
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) =>
          cs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              secure: options?.secure ?? isProd,
              sameSite: (options?.sameSite as 'lax' | 'strict' | 'none') ?? 'lax',
            })
          ),
      },
    }
  )
}

export function createMiddlewareClient(req: NextRequest, res: NextResponse) {
  const isProd = process.env.NODE_ENV === 'production'
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cs) =>
          cs.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, {
              ...options,
              secure: options?.secure ?? isProd,
              sameSite: (options?.sameSite as 'lax' | 'strict' | 'none') ?? 'lax',
            })
          ),
      },
    }
  )
}
