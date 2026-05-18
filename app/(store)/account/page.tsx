import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import SignOutButton from '@/components/store/SignOutButton'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const session = await getSession()
  if (!session) redirect('/auth/login?next=/account')

  const user = await prisma.user.upsert({
    where: { email: session.user.email! },
    update: {},
    create: {
      email: session.user.email!,
      name: session.user.user_metadata?.full_name ?? session.user.email!,
    },
    select: { name: true, email: true, createdAt: true },
  })

  const wishlistCount = await prisma.wishlist.count({
    where: { user: { email: session.user.email! } },
  })

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="font-display text-4xl text-gray-900 mb-2" style={{ fontWeight: 400, letterSpacing: '0.06em' }}>
        My Account
      </h1>
      <p className="text-sm text-gray-400 mb-12 tracking-wide">Welcome back</p>

      {/* Profile card */}
      <div className="bg-brand-cream rounded-sm p-6 mb-6 space-y-3">
        <p className="text-xs text-gray-400 tracking-widest uppercase">Profile</p>
        <p className="font-display text-xl text-gray-900" style={{ fontWeight: 400 }}>{user?.name}</p>
        <p className="text-sm text-gray-500">{user?.email}</p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <Link
          href="/wishlist"
          className="bg-brand-cream rounded-sm p-5 flex items-center justify-between group hover:border-brand-gold border border-transparent transition-colors"
        >
          <div>
            <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Wishlist</p>
            <p className="font-display text-2xl text-gray-900" style={{ fontWeight: 400 }}>{wishlistCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">{wishlistCount === 1 ? 'saved piece' : 'saved pieces'}</p>
          </div>
          <svg className="w-5 h-5 text-gray-300 group-hover:text-brand-gold transition-colors" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
          </svg>
        </Link>

        <Link
          href="/shop"
          className="bg-brand-cream rounded-sm p-5 flex items-center justify-between group hover:border-brand-gold border border-transparent transition-colors"
        >
          <div>
            <p className="text-xs text-gray-400 tracking-widest uppercase mb-1">Collections</p>
            <p className="text-sm text-gray-600 mt-2">Browse all pieces</p>
          </div>
          <svg className="w-5 h-5 text-gray-300 group-hover:text-brand-gold transition-colors" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      <SignOutButton />
    </div>
  )
}
