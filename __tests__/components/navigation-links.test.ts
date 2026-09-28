import { HEADER_NAV_CATEGORIES, categoryHref } from '@/lib/catalogue-ui';
import { footerShopLinks } from '@/lib/footer-content';

describe('Navigation & Shop Links (FUNC-01)', () => {
  it('does not include unstocked necklaces in HEADER_NAV_CATEGORIES', () => {
    expect(HEADER_NAV_CATEGORIES).not.toContain('necklaces');
    expect(HEADER_NAV_CATEGORIES[0]).toBe('rings');
    expect(HEADER_NAV_CATEGORIES).toEqual(['rings', 'earrings', 'pendants', 'bracelets', 'mangalsutra']);
  });

  it('points All Jewellery in footerShopLinks to a stocked category (rings)', () => {
    const allJewellery = footerShopLinks.find((l) => l.label === 'All Jewellery');
    expect(allJewellery).toBeDefined();
    expect(allJewellery?.href).toBe(categoryHref('rings'));
    expect(allJewellery?.href).not.toBe('/all-products/necklaces');
  });

  it('ensures all footer shop links point to valid stocked categories', () => {
    for (const link of footerShopLinks) {
      expect(link.href).not.toContain('necklaces');
    }
  });
});
