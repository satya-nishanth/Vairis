/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HeaderSearchButton } from '@/components/layout/HeaderSearchButton';

describe('HeaderSearchButton (FUNC-03)', () => {
  it('renders a visible, clickable search button that toggles search overlay', () => {
    render(<HeaderSearchButton />);

    const searchBtn = screen.getByRole('button', { name: /search/i });
    expect(searchBtn).toBeInTheDocument();
    expect(searchBtn).toHaveAttribute('type', 'button');
    expect(searchBtn).toHaveAttribute('aria-expanded', 'false');

    // Click to open overlay
    fireEvent.click(searchBtn);
    expect(searchBtn).toHaveAttribute('aria-expanded', 'true');

    // Search dialog / overlay input is present
    const searchInput = screen.getByPlaceholderText(/search jewellery\.\.\./i);
    expect(searchInput).toBeInTheDocument();
  });
});
