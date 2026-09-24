/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NavCategoryLinks } from "@/components/layout/NavCategoryLinks";

describe("NavCategoryLinks", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("renders default categories immediately", () => {
    global.fetch = jest.fn().mockImplementation(() =>
      new Promise(() => {}) // never resolves to inspect initial render
    );

    render(<NavCategoryLinks />);

    expect(screen.getByRole("link", { name: "Rings" })).toHaveAttribute(
      "href",
      "/all-products/rings",
    );
    expect(screen.getByRole("link", { name: "Earrings" })).toHaveAttribute(
      "href",
      "/all-products/earrings",
    );
    expect(screen.getByRole("link", { name: "Mangalsutra" })).toHaveAttribute(
      "href",
      "/all-products/mangalsutra",
    );
  });

  it("updates categories when /api/nav-categories returns new header categories", async () => {
    const updatedNav = [
      { slug: "rings", name: "Rings" },
      { slug: "solitaires", name: "Solitaires" },
    ];

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => updatedNav,
    } as any);

    render(<NavCategoryLinks />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Solitaires" })).toHaveAttribute(
        "href",
        "/all-products/solitaires",
      );
    });

    // Earrings is not in the updatedNav list so it shouldn't be rendered
    expect(screen.queryByRole("link", { name: "Earrings" })).not.toBeInTheDocument();
  });
});
