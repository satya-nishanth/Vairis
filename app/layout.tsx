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
  description: 'Discover exquisite jewellery crafted with precision. Rings, earrings, pendants and bracelets.',
  openGraph: {
    title: 'Vairis Fine Jewellery',
    description: 'Discover exquisite jewellery crafted with precision.',
    siteName: 'Vairis',
    type: 'website',
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
