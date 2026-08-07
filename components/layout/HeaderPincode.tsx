"use client";

import { useState } from "react";

const DEFAULT_PINCODE = "560001";

export function HeaderPincode({ className }: { className?: string }) {
  const [pincode, setPincode] = useState(DEFAULT_PINCODE);

  function handleChange() {
    const next = window.prompt("Enter delivery pincode", pincode);
    if (next?.trim()) setPincode(next.trim());
  }

  return (
    <div className={["header-pincode", className].filter(Boolean).join(" ")}>
      <span className="header-pincode__icon" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      </span>
      <div className="header-pincode__text">
        <span className="header-pincode__label">Deliver to</span>
        <button type="button" className="header-pincode__value" onClick={handleChange}>
          {pincode}
        </button>
      </div>
    </div>
  );
}
