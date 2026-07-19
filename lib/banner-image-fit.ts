/**
 * Per-slide hero focal points (CSS object-position).
 * Separate web / mobile so crop framing can differ by viewport.
 */

export type BannerImageFit = {
  webX: number
  webY: number
  mobileX: number
  mobileY: number
}

export const DEFAULT_BANNER_FIT: BannerImageFit = {
  webX: 50,
  webY: 50,
  mobileX: 50,
  mobileY: 50,
}

function clampPct(n: unknown, fallback = 50): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(100, Math.max(0, Math.round(v)))
}

export function parseBannerFit(raw: unknown): BannerImageFit {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_BANNER_FIT }
  const o = raw as Record<string, unknown>
  return {
    webX: clampPct(o.webX),
    webY: clampPct(o.webY),
    mobileX: clampPct(o.mobileX),
    mobileY: clampPct(o.mobileY),
  }
}

/** Align fits[] length to images[]; pad with defaults. */
export function normalizeImageFits(images: string[], fits: unknown): BannerImageFit[] {
  const list = Array.isArray(fits) ? fits : []
  return images.map((_, i) => parseBannerFit(list[i]))
}

export function fitToObjectPosition(fit: BannerImageFit, mode: 'web' | 'mobile'): string {
  return mode === 'mobile' ? `${fit.mobileX}% ${fit.mobileY}%` : `${fit.webX}% ${fit.webY}%`
}

/** CSS variables for responsive object-position (see .banner-fit). */
export function fitToCssVars(fit: BannerImageFit | undefined): Record<string, string> {
  const f = fit ?? DEFAULT_BANNER_FIT
  return {
    '--banner-fit-web': `${f.webX}% ${f.webY}%`,
    '--banner-fit-mobile': `${f.mobileX}% ${f.mobileY}%`,
  }
}

export function defaultFitsFor(count: number): BannerImageFit[] {
  return Array.from({ length: count }, () => ({ ...DEFAULT_BANNER_FIT }))
}
