import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.blob.core.windows.net https://vairisprodmedia.blob.core.windows.net https://*.supabase.co https://lh3.googleusercontent.com https://www.googletagmanager.com",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.blob.core.windows.net https://vairisprodmedia.blob.core.windows.net https://*.google-analytics.com https://www.google-analytics.com https://vitals.vercel-insights.com https://*.ingest.sentry.io https://*.sentry.io",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/auth/admin',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/catalogue/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/mock-pay/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
  experimental: {
    // Azure Container Apps ingress terminates TLS in front of the container and can present
    // a different Host to Next.js than the Origin the browser actually sent — Next's default
    // Server Actions same-origin check then rejects every action POST with no visible error
    // (form just silently no-ops: no request ever reaches the route, nothing logged server-side
    // past the framework boundary). Broke signup/signin sitewide in prod behind the custom
    // domain (2026-09-19) since this was never set. staging uses the container's own default
    // *.azurecontainerapps.io domain, listed too in case its ingress does the same rewrite.
    serverActions: {
      allowedOrigins: ['www.thevairis.com', 'thevairis.com', '*.azurecontainerapps.io'],
    },
  },
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
