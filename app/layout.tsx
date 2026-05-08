import type { Metadata } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import './globals.css'

const display = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Vairis Fine Jewellery',
  description: 'Where heritage meets the extraordinary. Fine jewellery, reimagined.',
  openGraph: {
    title: 'VAIRIS — Fine Jewellery',
    description: 'Where heritage meets the extraordinary. Fine jewellery, reimagined.',
    siteName: 'Vairis',
    type: 'website',
  },
  icons: {
    icon: '/images/logo_icon.png',
    shortcut: '/images/logo_icon.png',
    apple: '/images/logo_icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
