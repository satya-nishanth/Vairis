const prefetched = new Set<string>()

/** Warm browser cache for catalogue media (images + videos). */
export function prefetchCatalogueMedia(url: string, isVideo: boolean) {
  if (typeof window === 'undefined' || !url || prefetched.has(url)) return
  prefetched.add(url)

  if (isVideo) {
    const v = document.createElement('video')
    v.preload = 'auto'
    v.muted = true
    v.playsInline = true
    v.src = url
    v.load()
    return
  }

  const img = new Image()
  img.decoding = 'async'
  img.src = url
}

export function mediaOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}
