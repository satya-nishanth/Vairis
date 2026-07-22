"use client";

import { useCallback, useEffect, useState } from "react";
import { ProductImage } from "@/components/ui/ProductImage";
import { fitToCssVars, type BannerImageFit } from "@/lib/banner-image-fit";

type HeroCarouselProps = {
  slides: readonly string[];
  alt?: string;
  imageFits?: BannerImageFit[];
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  autoRotate?: boolean;
};

export function HeroCarousel({
  slides,
  alt = "VAIRIS jewellery",
  imageFits,
  activeIndex: controlledIndex,
  onActiveIndexChange,
  autoRotate,
}: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const isControlled = controlledIndex !== undefined;
  const shouldAutoRotate = autoRotate ?? !isControlled;
  const current = count > 0 ? (isControlled ? controlledIndex : index) % count : 0;

  const next = useCallback(() => {
    if (count <= 0) return;
    const n = (current + 1) % count;
    if (isControlled) onActiveIndexChange?.(n);
    else setIndex(n);
  }, [count, current, isControlled, onActiveIndexChange]);

  const prev = useCallback(() => {
    if (count <= 0) return;
    const n = (current - 1 + count) % count;
    if (isControlled) onActiveIndexChange?.(n);
    else setIndex(n);
  }, [count, current, isControlled, onActiveIndexChange]);

  useEffect(() => {
    if (!shouldAutoRotate || count <= 1) return;
    const timer = window.setInterval(next, 5000);
    return () => window.clearInterval(timer);
  }, [count, next, shouldAutoRotate]);

  if (count === 0) return null;

  return (
    <div className="hero__media">
      {slides.map((src, i) => (
        <ProductImage
          key={`${src}-${i}`}
          src={src}
          alt={alt}
          fill
          priority={i === 0}
          className={`hero__slide banner-fit${i === current ? " is-active" : ""}`}
          style={fitToCssVars(imageFits?.[i])}
        />
      ))}
      {count > 1 && (
        <div className="hero__carousel">
          <button type="button" aria-label="Previous slide" onClick={prev}>
            ‹
          </button>
          <button type="button" aria-label="Next slide" onClick={next}>
            ›
          </button>
        </div>
      )}
    </div>
  );
}
