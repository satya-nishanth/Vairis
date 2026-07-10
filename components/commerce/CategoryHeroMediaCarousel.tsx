"use client";

import { useEffect, useState } from "react";
import { MarketingImage } from "@/components/ui/MarketingImage";

type CategoryHeroMediaCarouselProps = {
  images: string[];
  label: string;
};

const ROTATE_MS = 5000;

export function CategoryHeroMediaCarousel({ images, label }: CategoryHeroMediaCarouselProps) {
  const [index, setIndex] = useState(0);
  const slides = images.length > 0 ? images : [];

  // Clamp rather than resetting state in an effect when the slide set changes
  const activeIndex = slides.length > 0 ? index % slides.length : 0;

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

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
            key={src}
            src={src}
            alt={`${label} - look ${i + 1}`}
            width={1200}
            height={900}
            fill
            className={`plp-hero__carousel-slide-img${i === activeIndex ? " is-active" : ""}`}
            priority={i === 0}
          />
        ))}
      </div>
      {slides.length > 1 && (
        <div className="plp-hero__carousel-dots plp-hero__carousel-dots--overlay" aria-hidden={false}>
          {slides.map((src, i) => (
            <button
              key={src}
              type="button"
              className={i === activeIndex ? "is-active" : ""}
              aria-label={`Show image ${i + 1} of ${slides.length}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
