/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PlpMobileBar } from "@/components/commerce/PlpMobileBar";

jest.mock("@/components/icons/ThemeIcon", () => ({ ThemeIcon: () => null }));

const base = {
  activeFilters: 0,
  sort: "recommended" as const,
  worn: false,
  canShowWorn: true,
  noun: "earrings",
  onOpenFilters: jest.fn(),
  onOpenSort: jest.fn(),
  onToggleWorn: jest.fn(),
};

describe("PlpMobileBar", () => {
  it("shows Filter, Sort and a Worn switch named for the category", () => {
    const onToggleWorn = jest.fn();
    render(<PlpMobileBar {...base} onToggleWorn={onToggleWorn} />);

    const sw = screen.getByRole("switch", { name: "Show earrings as worn" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw).toHaveTextContent("Worn");
    expect(sw).toHaveTextContent("Off");
    fireEvent.click(sw);
    expect(onToggleWorn).toHaveBeenCalled();
  });

  it("marks the switch on, with the green fill class", () => {
    render(<PlpMobileBar {...base} worn />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(sw).toHaveClass("is-on");
    expect(sw).toHaveTextContent("On");
  });

  it("hides the switch when no product has a worn photo", () => {
    render(<PlpMobileBar {...base} canShowWorn={false} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
