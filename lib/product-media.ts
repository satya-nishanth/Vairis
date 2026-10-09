/** Fixed angle views: Front → Left → Right → Back. */
export const PRODUCT_ANGLE_COUNT = 4

/** Optional product videos after the four angles. */
export const PRODUCT_VIDEO_SLOT_COUNT = 3

/** Index of the optional PLP hover image (after video slots). */
export const PRODUCT_HOVER_INDEX = PRODUCT_ANGLE_COUNT + PRODUCT_VIDEO_SLOT_COUNT

/** Extra gallery images start after angles + videos + hover. */
export const PRODUCT_EXTRA_START = PRODUCT_HOVER_INDEX + 1

export function isProductVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url)
}

export function isProductVideoSlot(index: number): boolean {
  return index >= PRODUCT_ANGLE_COUNT && index < PRODUCT_HOVER_INDEX
}

/**
 * Canonical layout:
 * [Front, Left, Right, Back, Video1, Video2, Video3, Hover, ...extras]
 *
 * Migrates older layouts (1 video + extras at 5+, or 3 videos + extras at 7+)
 * by collecting videos/images from the tail and placing hover at index 7.
 * When the stored array is already long enough for a hover slot, index 7 is
 * treated as hover (image); former first-extra may land there until re-saved.
 */
export function normalizeProductImages(images: string[]): string[] {
  const angles = Array.from({ length: PRODUCT_ANGLE_COUNT }, (_, i) => images[i] ?? '')
  const rest = images.slice(PRODUCT_ANGLE_COUNT)
  const videos: string[] = []
  const extras: string[] = []
  let hover = ''

  const pushVideo = (url: string) => {
    if (videos.length < PRODUCT_VIDEO_SLOT_COUNT) videos.push(url)
    else extras.push(url)
  }

  if (images.length > PRODUCT_HOVER_INDEX) {
    for (let i = PRODUCT_ANGLE_COUNT; i < PRODUCT_HOVER_INDEX; i++) {
      const url = images[i] ?? ''
      if (!url) continue
      if (isProductVideoUrl(url)) pushVideo(url)
      else extras.push(url)
    }
    const hoverUrl = images[PRODUCT_HOVER_INDEX] ?? ''
    if (hoverUrl) {
      if (isProductVideoUrl(hoverUrl)) pushVideo(hoverUrl)
      else hover = hoverUrl
    }
    for (const url of images.slice(PRODUCT_EXTRA_START)) {
      if (!url) continue
      if (isProductVideoUrl(url)) pushVideo(url)
      else extras.push(url)
    }
  } else {
    for (const url of rest) {
      if (!url) continue
      if (isProductVideoUrl(url)) pushVideo(url)
      else extras.push(url)
    }
  }

  while (videos.length < PRODUCT_VIDEO_SLOT_COUNT) videos.push('')
  return [...angles, ...videos, hover, ...extras]
}

/** Persist empties through the hover slot so index 7 stays stable. */
export function padProductImagesForSave(images: string[]): string[] {
  const n = normalizeProductImages(images)
  let end = n.length - 1
  while (end >= PRODUCT_EXTRA_START && !n[end]) end--
  return n.slice(0, Math.max(PRODUCT_EXTRA_START, end + 1))
}

/** Front / face image — never prefers hover over angles. */
export function productFrontImage(images: string[] | null | undefined): string {
  const layout = normalizeProductImages(images ?? [])
  for (let i = 0; i < PRODUCT_ANGLE_COUNT; i++) {
    if (layout[i]) return layout[i]
  }
  for (let i = PRODUCT_EXTRA_START; i < layout.length; i++) {
    const url = layout[i]
    if (url && !isProductVideoUrl(url)) return url
  }
  const hover = layout[PRODUCT_HOVER_INDEX]
  if (hover && !isProductVideoUrl(hover)) return hover
  return layout.find((u) => Boolean(u)) ?? ''
}

/** Optional PLP hover swap image (slot 7), or null. */
export function productHoverImage(images: string[] | null | undefined): string | null {
  const layout = normalizeProductImages(images ?? [])
  const hover = layout[PRODUCT_HOVER_INDEX]
  if (!hover || isProductVideoUrl(hover)) return null
  return hover
}
