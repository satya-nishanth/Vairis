import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { WishlistProvider } from "@/components/commerce/WishlistProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { DEFAULT_SITE_THEME } from "@/lib/theme";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-serif-loaded",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-loaded",
});

export const metadata: Metadata = {
  title: "VAIRIS - Everyday Diamond Wear",
  description:
    "Minimal diamond jewellery designed for work, coffee runs, date nights and everyday confidence.",
  openGraph: {
    title: "VAIRIS - Everyday Diamond Wear",
    description:
      "Minimal diamond jewellery designed for work, coffee runs, date nights and everyday confidence.",
    siteName: "Vairis",
    type: "website",
  },
  icons: {
    icon: "/images/logo_icon.png",
    shortcut: "/images/logo_icon.png",
    apple: "/images/logo_icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${inter.variable}`}
      data-theme={DEFAULT_SITE_THEME}
      suppressHydrationWarning
    >
      <head>
        <script src="/scripts/vairis-theme-init.js" />
      </head>
      <body>
        <ThemeProvider defaultTheme={DEFAULT_SITE_THEME}>
          <AuthProvider>
            <WishlistProvider>
              {children}
              <Analytics />
            </WishlistProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
