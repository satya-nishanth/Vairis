import type { Metadata } from "next";
import Script from "next/script";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeInitScript } from "@/components/theme/ThemeInitScript";
import { WishlistProvider } from "@/components/commerce/WishlistProvider";
import { CartProvider } from "@/components/commerce/CartProvider";
import { PageViewTracker } from "@/components/layout/PageViewTracker";
import { DEFAULT_SITE_THEME } from "@/lib/theme";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

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

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://thevairis.com";
const IS_VERCEL = process.env.VERCEL === "1" || process.env.NEXT_PUBLIC_VERCEL_ANALYTICS === "1";

const isStaging =
  process.env.AZURE_ENV_NAME === "staging" ||
  BASE_URL.includes("staging") ||
  BASE_URL.includes("azurecontainerapps.io") ||
  process.env.VERCEL_ENV === "preview";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "VAIRIS — Everyday Diamond Wear",
    template: "%s | VAIRIS",
  },
  description:
    "Minimal diamond jewellery designed for work, coffee runs, date nights and everyday confidence.",
  alternates: {
    canonical: "./",
  },
  ...(isStaging
    ? {
        robots: {
          index: false,
          follow: false,
        },
      }
    : {}),
  openGraph: {
    title: "VAIRIS — Everyday Diamond Wear",
    description:
      "Minimal diamond jewellery designed for work, coffee runs, date nights and everyday confidence.",
    siteName: "Vairis",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
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
      <body suppressHydrationWarning>
        {/* SSR-only inject via useServerInsertedHTML — avoids React 19 script warning */}
        <ThemeInitScript />
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { send_page_view: false });`}
            </Script>
          </>
        )}
        <ThemeProvider defaultTheme={DEFAULT_SITE_THEME}>
          <WishlistProvider>
            <CartProvider>
              {children}
              <PageViewTracker />
              {IS_VERCEL && <Analytics />}
            </CartProvider>
          </WishlistProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
