"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/ui/ProductImage";
import type { Product } from "@/lib/ui-data";

type CategoryHeroCarouselProps = {
  products: Product[];
  categoryLabel: string;
};

export function CategoryHeroCarousel({ products, categoryLabel }: CategoryHeroCarouselProps) {
  const slides = products.slice(0, 8);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const active = slides[index];

  return (
    <div className="plp-hero__carousel">
      <div className="plp-hero__carousel-stage">
        {slides.map((product, i) => (
          <Link
            key={product.catalogueId}
            href={`/product/${product.slug}`}
            className={`plp-hero__carousel-slide${i === index ? " is-active" : ""}`}
          >
            <ProductImage src={product.image} alt={product.name} fill className="plp-hero__carousel-img" />
          </Link>
        ))}
      </div>
      <div className="plp-hero__carousel-meta">
        <p className="plp-hero__carousel-label">Top {categoryLabel}</p>
        <p className="plp-hero__carousel-name">{active.name}</p>
        {slides.length > 1 && (
          <div className="plp-hero__carousel-dots">
            {slides.map((product, i) => (
              <button
                key={product.catalogueId}
                type="button"
                className={i === index ? "is-active" : ""}
                aria-label={`Show slide ${i + 1}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
