"use client";

import { useEffect, useState } from "react";
import { MarketingImage } from "@/components/ui/MarketingImage";
import { fitToCssVars, type BannerImageFit } from "@/lib/banner-image-fit";
import { getCategoryFallbackHero } from "@/lib/category-hero-images";

type CategoryHeroMediaCarouselProps = {
  images: string[];
  label: string;
  imageFits?: BannerImageFit[];
  fallbackSrc?: string;
  /** Controlled slide index (admin preview). Omit for auto-rotate on storefront. */
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  /** Pause auto-rotate when true (default when controlled). */
  autoRotate?: boolean;
};

const ROTATE_MS = 5000;

export function CategoryHeroMediaCarousel({
  images,
  label,
  imageFits,
  fallbackSrc,
  activeIndex: controlledIndex,
  onActiveIndexChange,
  autoRotate,
}: CategoryHeroMediaCarouselProps) {
  const [index, setIndex] = useState(0);
  const resolvedFallback = fallbackSrc ?? getCategoryFallbackHero(label);
  const slides = images.length > 0 ? images : (resolvedFallback ? [resolvedFallback] : []);
  const isControlled = controlledIndex !== undefined;
  const shouldAutoRotate = autoRotate ?? !isControlled;

  const activeIndex =
    slides.length > 0
      ? (isControlled ? controlledIndex : index) % slides.length
      : 0;

  useEffect(() => {
    if (!shouldAutoRotate || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, shouldAutoRotate]);

  const select = (i: number) => {
    if (isControlled) onActiveIndexChange?.(i);
    else setIndex(i);
  };

  if (slides.length === 0) {
    return (
      <div className="plp-hero__media">
        <div className="plp-hero__carousel-stage plp-hero__carousel-stage--empty">
          <span className="img-placeholder">{label} - hero image</span>
        </div>
      </div>
    );
  }

  return (
    <div className="plp-hero__media">
      <div className="plp-hero__carousel-stage">
        {slides.map((src, i) => (
          <MarketingImage
            key={`${src}-${i}`}
            src={src}
            alt={`${label} - look ${i + 1}`}
            fallbackSrc={resolvedFallback}
            width={1200}
            height={900}
            fill
            className={`plp-hero__carousel-slide-img banner-fit${i === activeIndex ? " is-active" : ""}`}
            style={fitToCssVars(imageFits?.[i])}
            priority={i === 0}
          />
        ))}
      </div>
      {slides.length > 1 && (
        <div className="plp-hero__carousel-dots plp-hero__carousel-dots--overlay" aria-hidden={false}>
          {slides.map((src, i) => (
            <button
              key={`${src}-dot-${i}`}
              type="button"
              className={i === activeIndex ? "is-active" : ""}
              aria-label={`Show image ${i + 1} of ${slides.length}`}
              onClick={() => select(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
