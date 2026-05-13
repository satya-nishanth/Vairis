import { redirect } from 'next/navigation'

// OAuth callback is handled by /api/auth/callback/route.ts (Route Handler).
// This page exists only as a fallback — Supabase redirectTo points to the API route.
export default function CallbackPage() {
  redirect('/')
}
