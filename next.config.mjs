/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Local Supabase Storage
      { protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/object/public/**' },
      // Production Supabase Storage
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
    // Serve WebP/AVIF to supported browsers — 30-50% bandwidth saving vs JPEG
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images for 1 hour locally (default is 60s — too short, causes slow reloads)
    // On Vercel production this is handled by their edge CDN with 1yr TTL
    minimumCacheTTL: 3600,
    // Device sizes that generate responsive srcset breakpoints
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
}

export default nextConfig
