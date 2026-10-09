/** Fixed angle views: Front → Left → Right → Back. */
export const PRODUCT_ANGLE_COUNT = 4

/** Optional product videos after the four angles. */
export const PRODUCT_VIDEO_SLOT_COUNT = 3

/** Extra gallery images start after angles + video slots. */
export const PRODUCT_EXTRA_START = PRODUCT_ANGLE_COUNT + PRODUCT_VIDEO_SLOT_COUNT

export function isProductVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url)
}

/**
 * Canonical layout: [Front, Left, Right, Back, Video1, Video2, Video3, ...extras].
 * Migrates older products that only had one video slot (extras began at index 5).
 */
export function normalizeProductImages(images: string[]): string[] {
  const angles = Array.from({ length: PRODUCT_ANGLE_COUNT }, (_, i) => images[i] ?? '')
  const rest = images.slice(PRODUCT_ANGLE_COUNT)
  const videos: string[] = []
  const extras: string[] = []

  for (const url of rest) {
    if (!url) continue
    if (isProductVideoUrl(url)) {
      if (videos.length < PRODUCT_VIDEO_SLOT_COUNT) videos.push(url)
      else extras.push(url)
    } else {
      extras.push(url)
    }
  }

  while (videos.length < PRODUCT_VIDEO_SLOT_COUNT) videos.push('')
  return [...angles, ...videos, ...extras]
}
