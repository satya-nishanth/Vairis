/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategoryPagination } from '@/components/commerce/CategoryPagination';

describe('CategoryPagination', () => {
  it('renders nothing when totalPages is 1', () => {
    const { container } = render(
      <CategoryPagination page={1} totalPages={1} onPageChange={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders disabled Previous button on page 1 and links for other pages', () => {
    const onPageChange = jest.fn();
    render(
      <CategoryPagination
        page={1}
        totalPages={4}
        onPageChange={onPageChange}
        buildHref={(p) => `/all-products/rings?page=${p}`}
      />
    );

    const prevButton = screen.getByRole('button', { name: /previous/i });
    expect(prevButton).toBeDisabled();
    expect(prevButton).toHaveAttribute('aria-disabled', 'true');

    // Page 1 is active
    const page1Link = screen.getByRole('link', { name: /page 1, current page/i });
    expect(page1Link).toHaveAttribute('aria-current', 'page');
    expect(page1Link).toHaveClass('is-active');

    // Page 2 is a link
    const page2Link = screen.getByRole('link', { name: /go to page 2/i });
    expect(page2Link).toHaveAttribute('href', '/all-products/rings?page=2');

    // Next is a link to page 2
    const nextLink = screen.getByRole('link', { name: /go to next page/i });
    expect(nextLink).toHaveAttribute('href', '/all-products/rings?page=2');
  });

  it('calls onPageChange when clicking a page link', () => {
    const onPageChange = jest.fn();
    render(
      <CategoryPagination
        page={1}
        totalPages={4}
        onPageChange={onPageChange}
        buildHref={(p) => `/all-products/rings?page=${p}`}
      />
    );

    const page2Link = screen.getByRole('link', { name: /go to page 2/i });
    fireEvent.click(page2Link);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders disabled Next button on last page', () => {
    render(
      <CategoryPagination
        page={4}
        totalPages={4}
        onPageChange={jest.fn()}
        buildHref={(p) => `/all-products/rings?page=${p}`}
      />
    );

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();
    expect(nextButton).toHaveAttribute('aria-disabled', 'true');

    const prevLink = screen.getByRole('link', { name: /go to previous page/i });
    expect(prevLink).toHaveAttribute('href', '/all-products/rings?page=3');
  });
});

describe('CategoryPagination windows', () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  const setPhone = (matches: boolean) => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as unknown as typeof window.matchMedia;
  };
  const labels = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.plp-pagination__pages > li')).map((li) => li.textContent);

  it('shows first, last and current ±1 with a gap on desktop', () => {
    setPhone(false);
    const { container } = render(<CategoryPagination page={6} totalPages={12} onPageChange={jest.fn()} />);
    expect(labels(container)).toEqual(['1', '…', '5', '6', '7', '…', '12']);
  });

  it('shows at most 6 number slots on a phone, and the … is not focusable', () => {
    setPhone(true);
    const { container } = render(<CategoryPagination page={1} totalPages={12} onPageChange={jest.fn()} />);
    expect(labels(container)).toEqual(['1', '2', '3', '4', '…', '12']);
    const gap = container.querySelector('.plp-pagination__ellipsis');
    expect(gap).toHaveAttribute('aria-hidden', 'true');
    expect(gap?.querySelector('a, button')).toBeNull();
  });
});
