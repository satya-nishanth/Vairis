"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/ui/ProductImage";
import { categoryHref, type ShopCategory } from "@/lib/catalogue-ui";

type CategoryCardProps = {
  slug: ShopCategory | string;
  title: string;
  description: string;
  images: string[];
  compact?: boolean;
};

export function CategoryCard({ slug, title, description, images, compact = false }: CategoryCardProps) {
  const slides = images.length > 0 ? images : [""];
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleSlides = compact ? slides.slice(0, 1) : slides;

  useEffect(() => {
    if (compact || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [compact, slides.length]);

  return (
    <Link href={categoryHref(slug)} className={`card-category${compact ? " card-category--compact" : ""}`}>
      <div className="card-category__media">
        {visibleSlides.map((src, index) => (
          <ProductImage
            key={`${slug}-${src}-${index}`}
            src={src}
            alt={title}
            width={compact ? 120 : 600}
            height={compact ? 120 : 750}
            className={`card-category__img${index === activeIndex ? " is-active" : ""}`}
          />
        ))}
        {!compact && <div className="card-category__shade" aria-hidden />}
      </div>
      <div className="card-category__body">
        <h3 className="card-category__title">{title}</h3>
        {!compact && (
          <>
            <p className="card-category__desc">{description}</p>
            <span className="card-category__arrow" aria-hidden>
              →
            </span>
          </>
        )}
      </div>
    </Link>
  );
}
