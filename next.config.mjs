/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Local Supabase — original object URLs
      { protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/object/public/**' },
      // Local Supabase — imgproxy transform URLs (responsive, format-negotiated)
      { protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/render/image/public/**' },
      // Production Supabase — original
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      // Production Supabase — imgproxy transform
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/render/image/public/**' },
    ],
    // Serve WebP/AVIF automatically — browser picks best format via Accept header
    formats: ['image/avif', 'image/webp'],
  },
}

export default nextConfig
