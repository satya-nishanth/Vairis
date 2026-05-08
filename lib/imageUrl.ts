/**
 * Converts a Supabase Storage object URL to a transform URL.
 * Supabase's imgproxy serves WebP/AVIF to modern browsers automatically,
 * resizes on the fly, and is CDN-cached — zero extra setup required.
 *
 * transform URL format:
 *   .../storage/v1/render/image/public/{bucket}/{path}?width=N&quality=Q&resize=cover
 */
export type ImageTransformOpts = {
  width?: number
  height?: number
  quality?: number
  resize?: 'cover' | 'contain' | 'fill'
}

export function storageUrl(url: string, opts: ImageTransformOpts = {}): string {
  if (!url) return url
  // Only transform Supabase Storage URLs
  if (!url.includes('/storage/v1/object/public/')) return url

  const { width = 800, quality = 80, resize = 'cover' } = opts
  const params = new URLSearchParams()
  if (width) params.set('width', String(width))
  if (opts.height) params.set('height', String(opts.height))
  params.set('quality', String(quality))
  params.set('resize', resize)

  const transformBase = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
  return `${transformBase}?${params.toString()}`
}

/** Thumbnail — product cards, admin table (small square) */
export const thumb = (url: string) => storageUrl(url, { width: 400, height: 400, quality: 75 })

/** Medium — product grid on mobile */
export const medium = (url: string) => storageUrl(url, { width: 800, quality: 80 })

/** Large — product detail page hero */
export const large = (url: string) => storageUrl(url, { width: 1200, quality: 85 })

/** Check if URL is a video */
export const isVideo = (url: string) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url)
