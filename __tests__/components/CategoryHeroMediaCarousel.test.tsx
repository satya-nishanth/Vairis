/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategoryHeroMediaCarousel } from '@/components/commerce/CategoryHeroMediaCarousel';
import { MarketingImage } from '@/components/ui/MarketingImage';
import { getCategoryFallbackHero } from '@/lib/category-hero-images';

describe('CategoryHeroMediaCarousel & MarketingImage resilience', () => {
  it('resolves valid fallback hero images for all primary categories', () => {
    expect(getCategoryFallbackHero('rings')).toBe('/images/category_hero/rings/rings.png');
    expect(getCategoryFallbackHero('earrings')).toBe('/images/category_hero/ear_rings/1.png');
    expect(getCategoryFallbackHero('pendants')).toBe('/images/category_hero/pendants/pendants.png');
    expect(getCategoryFallbackHero('bracelets')).toBe('/images/category_hero/bracelet/1.png');
    expect(getCategoryFallbackHero('mangalsutra')).toBe('/images/category_hero/pendants/pendants.png');
    expect(getCategoryFallbackHero('necklaces')).toBe('/images/category_hero/necklace/1.png');
  });

  it('MarketingImage does not leak raw alt text into DOM when image fails to load', () => {
    const { container } = render(
      <MarketingImage
        src="/non-existent.jpg"
        alt="Rings - look 1"
        width={1200}
        height={900}
      />
    );

    const img = screen.getByRole('img');
    fireEvent.error(img);

    // The container should have aria-label="Rings - look 1" for accessibility
    expect(container.querySelector('.img-placeholder')).toBeInTheDocument();
    expect(container.querySelector('.img-placeholder')).toHaveAttribute('aria-label', 'Rings - look 1');
    // But it should NOT have visible text "Rings - look 1" printed inside the div
    expect(container.querySelector('.img-placeholder')?.textContent).toBe('');
  });

  it('MarketingImage tries fallbackSrc before failing', () => {
    render(
      <MarketingImage
        src="/broken-banner.jpg"
        fallbackSrc="/images/category_hero/rings/rings.png"
        alt="Rings - look 1"
        width={1200}
        height={900}
      />
    );

    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toContain('/broken-banner.jpg');

    // Trigger error on initial broken src
    fireEvent.error(img);

    // Should switch src to fallbackSrc instead of entering failed placeholder state
    expect(img.getAttribute('src')).toContain('/images/category_hero/rings/rings.png');
  });

  it('CategoryHeroMediaCarousel renders fallback slide when images array is empty', () => {
    const { container } = render(
      <CategoryHeroMediaCarousel
        images={[]}
        label="Rings"
      />
    );

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute('src')).toContain('/images/category_hero/rings/rings.png');
  });
});
