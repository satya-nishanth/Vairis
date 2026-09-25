"use client";

import { useState, useEffect, useRef } from "react";

const DEFAULT_PINCODE = "560001";

export function HeaderPincode({ className }: { className?: string }) {
  const [pincode, setPincode] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("vairis_pincode");
        if (saved && /^\d{6}$/.test(saved)) return saved;
      } catch {}
    }
    return DEFAULT_PINCODE;
  });
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(pincode);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function handleToggle() {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setInputValue(pincode);
        setError(null);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = inputValue.trim();
    if (!/^[1-9][0-9]{5}$/.test(clean)) {
      setError("Please enter a valid 6-digit PIN");
      return;
    }
    setPincode(clean);
    try {
      localStorage.setItem("vairis_pincode", clean);
    } catch {}
    setIsOpen(false);
  }

  return (
    <div
      ref={popoverRef}
      className={["header-pincode", className].filter(Boolean).join(" ")}
      style={{ position: "relative" }}
    >
      <span className="header-pincode__icon" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      </span>
      <div className="header-pincode__text">
        <span className="header-pincode__label">Deliver to</span>
        <button
          type="button"
          className="header-pincode__value"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          {pincode}
        </button>
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Enter Delivery Pincode"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 100,
            background: "var(--bg-card, #fff)",
            border: "1px solid var(--color-border, #e5e5e5)",
            borderRadius: "var(--radius-sm, 6px)",
            padding: "16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            minWidth: "240px",
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              htmlFor="header-pincode-input"
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--color-text)",
              }}
            >
              Enter Delivery PIN
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                id="header-pincode-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                placeholder="e.g. 560001"
                autoFocus
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: "0.875rem",
                  border: "1px solid var(--color-border, #ccc)",
                  borderRadius: "4px",
                  background: "var(--bg-page, #fff)",
                  color: "var(--color-text)",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "6px 12px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  backgroundColor: "var(--color-primary, #111)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Apply
              </button>
            </div>
            {error && (
              <span style={{ fontSize: "0.6875rem", color: "#e11d48" }}>{error}</span>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
