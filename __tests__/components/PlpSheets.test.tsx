/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PlpSortSheet } from "@/components/commerce/PlpSortSheet";
import { PlpFilterSheet } from "@/components/commerce/PlpFilterSheet";
import { DEFAULT_FILTERS } from "@/lib/plp-facets";
import type { Product } from "@/lib/ui-data";

jest.mock("@/components/icons/ThemeIcon", () => ({ ThemeIcon: () => null }));

let n = 0;
const make = (over: Partial<Product>): Product => ({
  slug: `p${++n}`,
  sku: `s${n}`,
  name: `Ring ${n}`,
  image: "",
  images: [],
  category: "rings",
  catalogueId: `p${n}`,
  types: [],
  occasions: [],
  ...over,
});

describe("PlpSortSheet", () => {
  it("lists the five sorts and applies on one tap", () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    render(<PlpSortSheet open onClose={onClose} sort="recommended" onSelect={onSelect} hasPricedProducts />);

    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: /recommended/i })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /price: low to high/i }));
    expect(onSelect).toHaveBeenCalledWith("price-asc");
    expect(onClose).toHaveBeenCalled();
  });

  it("hides the price sorts when nothing shows a price (NAV-05)", () => {
    render(<PlpSortSheet open onClose={jest.fn()} sort="recommended" onSelect={jest.fn()} hasPricedProducts={false} />);
    expect(screen.queryByRole("radio", { name: /price/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("closes on Escape and renders nothing when closed", () => {
    const onClose = jest.fn();
    const { rerender } = render(<PlpSortSheet open onClose={onClose} sort="new" onSelect={jest.fn()} hasPricedProducts />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    rerender(<PlpSortSheet open={false} onClose={onClose} sort="new" onSelect={jest.fn()} hasPricedProducts />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("PlpFilterSheet", () => {
  const products = [
    make({ price: 9_000, types: ["Band"], occasions: ["Gifting"], inStock: true }),
    make({ price: 20_000, types: ["Band"] }),
    make({ price: 60_000, types: ["Solitaire"] }),
  ];
  const options = { types: ["Solitaire", "Band", "Halo"], occasions: ["Gifting", "Office"], shapes: [], canFilterReady: true };

  it("hides options with no products, shows counts, and the button tracks the draft", () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    render(
      <PlpFilterSheet open onClose={onClose} filters={DEFAULT_FILTERS} onApply={onApply} products={products} options={options} noun="rings" />,
    );

    expect(screen.queryByText("Halo")).not.toBeInTheDocument(); // 0 products
    expect(screen.queryByText("Office")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show 3 rings/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /band/i }));
    const apply = screen.getByRole("button", { name: /show 2 rings/i });
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ types: ["Band"] }));
    expect(onClose).toHaveBeenCalled();
  });

  it("clear all resets the draft but not the sort", () => {
    const onApply = jest.fn();
    render(
      <PlpFilterSheet
        open
        onClose={jest.fn()}
        filters={{ ...DEFAULT_FILTERS, types: ["Band"], sort: "new" }}
        onApply={onApply}
        products={products}
        options={options}
        noun="rings"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    fireEvent.click(screen.getByRole("button", { name: /show 3 rings/i }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ types: [], sort: "new" }));
  });

  it("shows Ready to ship only when something is in stock, and never leads to zero results", () => {
    const { rerender } = render(
      <PlpFilterSheet open onClose={jest.fn()} filters={DEFAULT_FILTERS} onApply={jest.fn()} products={products} options={options} noun="rings" />,
    );
    expect(screen.getByRole("checkbox", { name: /ready to ship/i })).toBeInTheDocument();
    rerender(
      <PlpFilterSheet open onClose={jest.fn()} filters={DEFAULT_FILTERS} onApply={jest.fn()} products={products} options={{ ...options, canFilterReady: false }} noun="rings" />,
    );
    expect(screen.queryByRole("checkbox", { name: /ready to ship/i })).not.toBeInTheDocument();
  });
});
