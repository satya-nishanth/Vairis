import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Phone-on-LAN testing hits http://192.168.x.x:3000, not localhost. Next 16 blocks
  // cross-origin /_next/* (incl. HMR + client chunks) unless the LAN origin is allow-listed —
  // without this, client components never hydrate and live totals stay at SSR ₹0.
  allowedDevOrigins: [
    '192.168.*.*',
    '10.*.*.*',
    '172.16.*.*',
    '172.17.*.*',
    '172.18.*.*',
    '172.19.*.*',
    '172.20.*.*',
    '172.21.*.*',
    '172.22.*.*',
    '172.23.*.*',
    '172.24.*.*',
    '172.25.*.*',
    '172.26.*.*',
    '172.27.*.*',
    '172.28.*.*',
    '172.29.*.*',
    '172.30.*.*',
    '172.31.*.*',
  ],
  // Self-hosted GoTrue (Azure migration) — proxies auth calls same-origin so the browser
  // never talks to GoTrue cross-origin. Bare GoTrue's CORS layer rejects the `apikey` header
  // supabase-js always sends (it expects a Kong gateway in front to have handled that), so a
  // direct browser→GoTrue call is silently blocked. No-op when GOTRUE_INTERNAL_URL is unset
  // (Vercel/Supabase-hosted environments, where NEXT_PUBLIC_SUPABASE_URL points at supabase.co
  // directly and this path is never called).
  async rewrites() {
    if (!process.env.GOTRUE_INTERNAL_URL) return [];
    return [
      // supabase-js always prepends `/auth/v1` to whatever base URL you configure — it assumes
      // Kong is in front stripping that prefix before GoTrue sees the request. Bare GoTrue (no
      // Kong) serves everything at the root instead, so the prefix has to be stripped here.
      { source: '/auth-api/auth/v1/:path*', destination: `${process.env.GOTRUE_INTERNAL_URL}/:path*` },
    ];
  },
  async redirects() {
    return [
      { source: '/shop', destination: '/all-products/rings', permanent: true },
      { source: '/shop/:category', destination: '/all-products/:category', permanent: true },
      { source: '/shop/product/:id', destination: '/product/:id', permanent: true },
    ];
  },
  images: {
    // Images are pre-resized to 1200px JPEG via Sharp on upload.
    // Vercel Hobby has 5K/month transformation limit — disabling to avoid hitting it.
    // Re-enable when on Pro or migrated to Azure.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: '*.blob.core.windows.net', pathname: '/product-media/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
    ],
  },
}

// Source-map upload only runs when SENTRY_AUTH_TOKEN is set (CI/prod);
// local dev and PRs without the token build normally, untouched.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: true,
      disableLogger: true,
      automaticVercelMonitors: false,
    })
  : nextConfig
