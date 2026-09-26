/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

describe('Breadcrumbs semantic markup & JSON-LD (NAV-01)', () => {
  const items = [
    { label: 'Home', href: '/' },
    { label: 'Rings', href: '/all-products/rings' },
    { label: 'Solitaire Diamond Ring' },
  ];

  it('renders semantic nav, ol, aria-current and JSON-LD script', () => {
    const { container } = render(<Breadcrumbs items={items} />);

    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();

    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();

    const currentItem = screen.getByText('Solitaire Diamond Ring');
    expect(currentItem).toHaveAttribute('aria-current', 'page');

    const jsonLdScript = container.querySelector('script[type="application/ld+json"]');
    expect(jsonLdScript).toBeInTheDocument();

    const parsedJsonLd = JSON.parse(jsonLdScript!.textContent || '{}');
    expect(parsedJsonLd['@type']).toBe('BreadcrumbList');
    expect(parsedJsonLd.itemListElement).toHaveLength(3);
    expect(parsedJsonLd.itemListElement[0].name).toBe('Home');
    expect(parsedJsonLd.itemListElement[2].name).toBe('Solitaire Diamond Ring');
  });
});
