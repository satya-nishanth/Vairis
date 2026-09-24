/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContactPage from '@/app/contact/page';
import {
  WHATSAPP_CONSULTATION_URL,
  WHATSAPP_SIZING_URL,
  WHATSAPP_STYLING_URL,
} from '@/lib/ui-data';

// Mock layout components that might rely on context
jest.mock('@/components/layout/PageShell', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div data-testid="page-shell">{children}</div>,
}));

describe('Contact Page Funnels & CTAs (FUNC-04 & FUNC-09)', () => {
  it('renders working consultation and booking links without dead anchors', () => {
    render(<ContactPage />);

    const allLinks = screen.getAllByRole('link');

    // Ensure no link has href="#" (excluding intentional internal anchors like #faq)
    for (const link of allLinks) {
      const href = link.getAttribute('href');
      expect(href).not.toBe('#');
      expect(href).not.toBe('/product/ajc03112nl-ne-reg'); // FUNC-09 404 link fixed
    }

    // Book a Call buttons point to consultation WhatsApp intent
    const bookCallLinks = screen.getAllByRole('link', { name: /book a call/i });
    expect(bookCallLinks.length).toBeGreaterThanOrEqual(2);
    bookCallLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', WHATSAPP_CONSULTATION_URL);
    });

    // Schedule Now link in help card
    const scheduleLink = screen.getByRole('link', { name: /schedule now/i });
    expect(scheduleLink).toHaveAttribute('href', WHATSAPP_CONSULTATION_URL);

    // Find Your Size link in help card
    const sizeLink = screen.getByRole('link', { name: /find your size/i });
    expect(sizeLink).toHaveAttribute('href', WHATSAPP_SIZING_URL);

    // Start Consultation link
    const startConsultLink = screen.getByRole('link', { name: /start consultation/i });
    expect(startConsultLink).toHaveAttribute('href', WHATSAPP_STYLING_URL);

    // Explore Collections link in cert box
    const certLink = screen.getByRole('link', { name: /explore collections/i });
    expect(certLink).toHaveAttribute('href', '/all-products/rings');
  });
});
