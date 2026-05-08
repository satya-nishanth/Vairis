import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'

// Cormorant Garamond — matches index.html, more elegant for jewellery
const display = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'VAIRIS — Fine Jewellery',
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
