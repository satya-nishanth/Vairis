import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeInitScript } from "@/components/theme/ThemeInitScript";
import { WishlistProvider } from "@/components/commerce/WishlistProvider";
import { CartProvider } from "@/components/commerce/CartProvider";
import { PageViewTracker } from "@/components/layout/PageViewTracker";
import { DEFAULT_SITE_THEME } from "@/lib/theme";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
/** Google Tag Manager container (e.g. GTM-XXXX). Optional — unset = no GTM. */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

// Self-hosted (Latin subset, variable weight) rather than next/font/google: the
// Google fetch at build time broke Vercel's Turbopack build ("next/font/google
// queries have exactly one entry") and ties every build to fonts.googleapis.com.
const cormorant = localFont({
  src: "./fonts/CormorantGaramond-latin-wght.woff2",
  weight: "600 700",
  display: "swap",
  variable: "--font-serif-loaded",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const inter = localFont({
  src: "./fonts/Inter-latin-wght.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-sans-loaded",
  fallback: ["system-ui", "Arial", "sans-serif"],
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
      className={inter.variable}
      data-theme={DEFAULT_SITE_THEME}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {GTM_ID ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        ) : null}
        {/* SSR-only inject via useServerInsertedHTML — avoids React 19 script warning */}
        <ThemeInitScript />
        {GTM_ID ? (
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        ) : null}
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
