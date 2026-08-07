"use client";

import { useState } from "react";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { MobileSearchOverlay } from "./MobileSearchOverlay";

export function HeaderSearchButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={["header-search-btn", className].filter(Boolean).join(" ")}
        aria-label="Search"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <ThemeIcon name="search" category="navigation" size={20} />
      </button>
      <MobileSearchOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
