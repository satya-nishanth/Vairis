"use client";

import { useCallback, useEffect, useState } from "react";
import { ProductImage } from "@/components/ui/ProductImage";

type HeroCarouselProps = {
  slides: readonly string[];
  alt?: string;
};

export function HeroCarousel({ slides, alt = "VAIRIS jewellery" }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  const next = useCallback(() => {
    setIndex((current) => (current + 1) % count);
  }, [count]);

  const prev = useCallback(() => {
    setIndex((current) => (current - 1 + count) % count);
  }, [count]);

  useEffect(() => {
    if (count <= 1) return;
    const timer = window.setInterval(next, 5000);
    return () => window.clearInterval(timer);
  }, [count, next]);

  return (
    <div className="hero__media">
      {slides.map((src, i) => (
        <ProductImage
          key={`${src}-${i}`}
          src={src}
          alt={alt}
          fill
          priority={i === 0}
          className={`hero__slide${i === index ? " is-active" : ""}`}
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
