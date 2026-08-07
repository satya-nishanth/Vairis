import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/layout/PageShell'
import { Container } from '@/components/ui/Container'
import { pageLayouts } from '@/lib/layout-config'
import SignOutButton from '@/components/auth/SignOutButton'

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

  const orderCount = await prisma.order.count({
    where: { user: { email: session.user.email! } },
  })

  return (
    <PageShell {...pageLayouts.contact}>
      <Container>
        <div style={{ maxWidth: '640px', margin: '0 auto', paddingBlock: 'var(--section-gap)' }}>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '2.5rem',
              fontWeight: 400,
              letterSpacing: '0.06em',
              color: 'var(--color-text)',
              marginBottom: '0.5rem',
            }}
          >
            My Account
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              letterSpacing: '0.05em',
              marginBottom: '3rem',
            }}
          >
            Welcome back
          </p>

          {/* Profile card */}
          <div
            style={{
              background: 'var(--color-surface-subtle, #f8f5f0)',
              padding: '1.5rem',
              marginBottom: '1.5rem',
            }}
          >
            <p
              style={{
                fontSize: '0.625rem',
                color: 'var(--color-text-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '0.75rem',
              }}
            >
              Profile
            </p>
            <p
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.25rem',
                fontWeight: 400,
                color: 'var(--color-text)',
                marginBottom: '0.25rem',
              }}
            >
              {user?.name}
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{user?.email}</p>
          </div>

          {/* Quick links */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '2.5rem',
            }}
          >
            <Link
              href="/account/orders"
              style={{
                background: 'var(--color-surface-subtle, #f8f5f0)',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textDecoration: 'none',
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: '0.625rem',
                    color: 'var(--color-text-muted)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: '0.25rem',
                  }}
                >
                  My Orders
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.5rem',
                    fontWeight: 400,
                    color: 'var(--color-text)',
                  }}
                >
                  {orderCount}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                  {orderCount === 1 ? 'order' : 'orders'}
                </p>
              </div>
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z"
                />
              </svg>
            </Link>
            <Link
              href="/wishlist"
              style={{
                background: 'var(--color-surface-subtle, #f8f5f0)',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textDecoration: 'none',
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: '0.625rem',
                    color: 'var(--color-text-muted)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: '0.25rem',
                  }}
                >
                  Wishlist
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.5rem',
                    fontWeight: 400,
                    color: 'var(--color-text)',
                  }}
                >
                  {wishlistCount}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                  {wishlistCount === 1 ? 'saved piece' : 'saved pieces'}
                </p>
              </div>
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
                style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
                />
              </svg>
            </Link>

            <Link
              href="/all-products/rings"
              style={{
                background: 'var(--color-surface-subtle, #f8f5f0)',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textDecoration: 'none',
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: '0.625rem',
                    color: 'var(--color-text-muted)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: '0.25rem',
                  }}
                >
                  Collections
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                  Browse all pieces
                </p>
              </div>
              <svg
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
                style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>

          <SignOutButton />
        </div>
      </Container>
    </PageShell>
  )
}
