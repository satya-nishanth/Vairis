/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategoryFilterPanel, defaultFilterState } from '@/components/commerce/CategoryFilterPanel';

describe('CategoryFilterPanel (NAV-04 & NAV-05)', () => {
  const dummyGroups = [
    {
      id: 'metals' as const,
      title: 'Metal',
      options: ['18K Yellow Gold', '18K White Gold', '18K Rose Gold'],
    },
  ];

  it('renders sort options including price when hasPricedProducts is true', () => {
    const onChange = jest.fn();
    render(
      <CategoryFilterPanel
        filters={defaultFilterState()}
        onChange={onChange}
        groups={dummyGroups}
        hasPricedProducts={true}
      />
    );

    expect(screen.getByRole('option', { name: 'Price: Low to High' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Price: High to Low' })).toBeInTheDocument();
  });

  it('hides price sort options when hasPricedProducts is false (NAV-05)', () => {
    const onChange = jest.fn();
    render(
      <CategoryFilterPanel
        filters={defaultFilterState()}
        onChange={onChange}
        groups={dummyGroups}
        hasPricedProducts={false}
      />
    );

    expect(screen.queryByRole('option', { name: 'Price: Low to High' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Price: High to Low' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Popular' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Newest' })).toBeInTheDocument();
  });

  it('triggers onChange when sort selection changes', () => {
    const onChange = jest.fn();
    render(
      <CategoryFilterPanel
        filters={defaultFilterState()}
        onChange={onChange}
        groups={dummyGroups}
        hasPricedProducts={true}
      />
    );

    const select = screen.getByRole('combobox', { name: /sort products/i });
    fireEvent.change(select, { target: { value: 'newest' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'newest' })
    );
  });
});
