import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'VAIRIS Catalogue',
  description: 'Browse the Vairis fine jewellery catalogue',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function CatalogueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-black min-h-screen"
      style={{ overscrollBehavior: 'none' }}
    >
      {children}
    </div>
  )
}
