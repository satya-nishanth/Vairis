/**
 * Image URL helpers.
 *
 * Supabase imgproxy (/render/image/) is not reliably available in local CLI
 * v2.90. In production Vercel handles WebP/AVIF/resize via Next.js /_next/image.
 * Here we just pass through the original URL — Next.js <Image> sizes prop
 * drives the responsive srcset automatically.
 */

export type ImageTransformOpts = {
  width?: number
  height?: number
  quality?: number
  resize?: 'cover' | 'contain' | 'fill'
}

/** Returns the URL as-is (Next.js Image handles optimization). */
export function storageUrl(url: string, _opts: ImageTransformOpts = {}): string {
  return url ?? ''
}

export const thumb = (url: string) => storageUrl(url)
export const medium = (url: string) => storageUrl(url)
export const large = (url: string) => storageUrl(url)

/** Check if a URL points to a video file */
export const isVideo = (url: string) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url)
