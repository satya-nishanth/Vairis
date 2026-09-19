import type { Metadata, Viewport } from 'next'
import { requireFinance } from '@/lib/finance-auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Add transaction · Vairis',
  description: 'Quick add for Vairis finance cashbook',
  manifest: '/manifest-finance-txn.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Add txn',
  },
  icons: {
    icon: '/images/logo_icon.png',
    apple: '/images/logo_icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#032b24',
}

export default async function MobileFinanceLayout({ children }: { children: React.ReactNode }) {
  await requireFinance()
  return <>{children}</>
}
