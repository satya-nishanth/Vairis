/** @type {import('next').NextConfig} */
const nextConfig = {
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
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
    ],
  },
}

export default nextConfig
