'use client'

import { useEffect, useRef, useState } from 'react'
import { CategoryHeroStory } from '@/components/commerce/CategoryHeroStory'
import { CategoryHeroMediaCarousel } from '@/components/commerce/CategoryHeroMediaCarousel'
import { HeroCarousel } from '@/components/home/HeroCarousel'
import { BannerFocusEditor } from '@/components/admin/BannerFocusEditor'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { ProductImage } from '@/components/ui/ProductImage'
import { marketingImages } from '@/lib/images'
import {
  DEFAULT_BANNER_FIT,
  type BannerImageFit,
} from '@/lib/banner-image-fit'

type PreviewMode = 'web' | 'mobile'

/** Desktop storefront reference width — crop/focus matches live ~1280px viewports. */
const WEB_CANVAS_W = 1280

type Props = {
  kind: 'category' | 'home' | 'promo'
  heading: string
  images: string[]
  imageFits?: BannerImageFit[]
  title: string
  subtitle: string
  intro?: string
  ctaLabel?: string
  linkUrl?: string
  active: boolean
  usingBuiltInStory?: boolean
  usingBuiltInImage?: boolean
  slideIndex?: number
  onSlideIndexChange?: (index: number) => void
  onFitChange?: (index: number, fit: BannerImageFit) => void
  previewMode?: PreviewMode
  onPreviewModeChange?: (mode: PreviewMode) => void
}

/**
 * Live storefront-sized banner preview using the real PLP / home hero components.
 * Web canvas is fixed to storefront proportions so crop matches the live site.
 */
export function BannerStorefrontPreview({
  kind,
  heading,
  images,
  imageFits,
  title,
  subtitle,
  intro,
  ctaLabel,
  linkUrl,
  active,
  usingBuiltInStory,
  usingBuiltInImage,
  slideIndex = 0,
  onSlideIndexChange,
  onFitChange,
  previewMode,
  onPreviewModeChange,
}: Props) {
  const [internalMode, setInternalMode] = useState<PreviewMode>('web')
  const mode = previewMode ?? internalMode
  const setMode = (m: PreviewMode) => {
    onPreviewModeChange?.(m)
    if (previewMode === undefined) setInternalMode(m)
  }

  const slides = images.filter(Boolean)
  const safeIndex = slides.length > 0 ? slideIndex % slides.length : 0
  const activeFit = imageFits?.[safeIndex] ?? DEFAULT_BANNER_FIT
  const activeSrc = slides[safeIndex]

  useEffect(() => {
    if (slides.length === 0) return
    if (slideIndex >= slides.length) onSlideIndexChange?.(slides.length - 1)
  }, [slides.length, slideIndex, onSlideIndexChange])

  return (
    <div className="banner-preview">
      <div className="banner-preview__toolbar">
        <p className="banner-preview__label">
          Live preview
          {slides.length > 0 ? ` · slide ${safeIndex + 1}/${slides.length}` : ''}
          {!active ? ' · inactive' : ''}
          {usingBuiltInImage ? ' · built-in images' : ''}
          {usingBuiltInStory ? ' · built-in story' : ''}
        </p>
        <div className="banner-preview__mode-pills" role="tablist" aria-label="Preview device">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'web'}
            className={mode === 'web' ? 'is-active' : undefined}
            onClick={() => setMode('web')}
          >
            Web
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'mobile'}
            className={mode === 'mobile' ? 'is-active' : undefined}
            onClick={() => setMode('mobile')}
          >
            Mobile
          </button>
        </div>
      </div>

      {slides.length > 0 && onFitChange && kind !== 'promo' && activeSrc && (
        <BannerFocusEditor
          src={activeSrc}
          slideLabel={`Slide ${safeIndex + 1} of ${slides.length}`}
          mode={mode}
          onModeChange={setMode}
          fit={activeFit}
          onChange={(fit) => onFitChange(safeIndex, fit)}
        />
      )}

      <div
        className={
          mode === 'mobile'
            ? 'banner-preview__stage banner-preview__stage--mobile'
            : 'banner-preview__stage banner-preview__stage--web'
        }
      >
        {mode === 'mobile' ? (
          <div className="banner-preview__phone">
            <div className="banner-preview__phone-notch" />
            <div
              className="banner-preview__phone-screen banner-preview--force-mobile banner-preview--storefront"
              data-theme="light"
            >
              <PreviewBody
                kind={kind}
                heading={heading}
                slides={slides}
                imageFits={imageFits}
                title={title}
                subtitle={subtitle}
                intro={intro}
                ctaLabel={ctaLabel}
                linkUrl={linkUrl}
                active={active}
                slideIndex={safeIndex}
                onSlideIndexChange={onSlideIndexChange}
              />
            </div>
            <p className="banner-preview__hint">Storefront mobile · 375px</p>
          </div>
        ) : (
          <ScaledWebPreview
            label={
              kind === 'category'
                ? `${heading} category page`
                : kind === 'home'
                  ? 'Home hero'
                  : heading
            }
          >
            <PreviewBody
              kind={kind}
              heading={heading}
              slides={slides}
              imageFits={imageFits}
              title={title}
              subtitle={subtitle}
              intro={intro}
              ctaLabel={ctaLabel}
              linkUrl={linkUrl}
              active={active}
              slideIndex={safeIndex}
              onSlideIndexChange={onSlideIndexChange}
            />
          </ScaledWebPreview>
        )}
      </div>
      <p className="banner-preview__footer">
        Preview matches storefront layout · drag focus pin · Save to publish.
      </p>
    </div>
  )
}

function ScaledWebPreview({ label, children }: { label: string; children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const sync = () => {
      const w = el.clientWidth
      if (w <= 0) return
      setScale(Math.min(1, w / WEB_CANVAS_W))
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="banner-preview__web-frame banner-preview--storefront" data-theme="light">
      <p className="banner-preview__frame-label">
        {label} · storefront {WEB_CANVAS_W}px
      </p>
      <div ref={wrapRef} className="banner-preview__scale-wrap">
        <div
          className="banner-preview__scale-canvas banner-preview--force-web"
          style={{
            width: WEB_CANVAS_W,
            transform: `scale(${scale})`,
            marginBottom: scale < 1 ? `-${(1 - scale) * 480}px` : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function PreviewBody({
  kind,
  heading,
  slides,
  imageFits,
  title,
  subtitle,
  intro,
  ctaLabel,
  linkUrl,
  active,
  slideIndex,
  onSlideIndexChange,
}: {
  kind: 'category' | 'home' | 'promo'
  heading: string
  slides: string[]
  imageFits?: BannerImageFit[]
  title: string
  subtitle: string
  intro?: string
  ctaLabel?: string
  linkUrl?: string
  active: boolean
  slideIndex: number
  onSlideIndexChange?: (index: number) => void
}) {
  const opacity = active ? 1 : 0.55

  if (kind === 'category') {
    return (
      <section className="plp-hero plp-hero--landing" style={{ opacity }}>
        <div className="plp-hero__content">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: heading }]} />
          <div className="plp-hero__hero-main">
            <CategoryHeroStory story={{ line1: title, line2: subtitle }} />
            {intro ? <p className="plp-hero__intro">{intro}</p> : null}
          </div>
        </div>
        <CategoryHeroMediaCarousel
          images={slides}
          label={heading}
          imageFits={imageFits}
          activeIndex={slideIndex}
          onActiveIndexChange={onSlideIndexChange}
          autoRotate={false}
        />
      </section>
    )
  }

  if (kind === 'home') {
    return (
      <section className="hero" style={{ opacity }}>
        <div className="hero__content">
          <p className="hero__eyebrow">Everyday Diamond Wear</p>
          <h1 className="hero__title">{title || "Diamonds You'll Actually Wear."}</h1>
          <p className="hero__desc">
            {subtitle ||
              'Minimal diamond jewellery designed for work, coffee runs, date nights and everyday confidence.'}
          </p>
          <div className="hero__ctas">
            <Button href={linkUrl || '/all-products/necklaces'} variant="primary">
              {ctaLabel || 'Shop Now'}
            </Button>
          </div>
          <div className="hero__social">
            <div className="hero__avatars">
              {marketingImages.hero.socialAvatars.map((avatarSrc) => (
                <ProductImage key={avatarSrc} src={avatarSrc} alt="Customer" width={32} height={32} />
              ))}
            </div>
            <span>IGI Certified · BIS Hallmarked · Insured Delivery</span>
          </div>
        </div>
        {slides.length > 0 ? (
          <HeroCarousel
            slides={slides}
            alt="VAIRIS jewellery"
            imageFits={imageFits}
            activeIndex={slideIndex}
            onActiveIndexChange={onSlideIndexChange}
            autoRotate={false}
          />
        ) : (
          <div className="hero__media">
            <span className="img-placeholder" style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
              Add hero images
            </span>
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="announcement-bar" style={{ opacity }}>
      <div className="announcement-bar__inner" style={{ justifyContent: 'center', padding: '12px 16px' }}>
        <span className="announcement-bar__item" style={{ color: '#fff' }}>
          {title || 'Promo text'}
          {subtitle ? ` — ${subtitle}` : ''}
          {ctaLabel ? ` · ${ctaLabel}` : ''}
        </span>
      </div>
    </div>
  )
}
