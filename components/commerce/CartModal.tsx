"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type CartModalContextValue = {
  openCartModal: () => void;
  closeCartModal: () => void;
};

const CartModalContext = createContext<CartModalContextValue | null>(null);

const noopContext: CartModalContextValue = {
  openCartModal: () => {},
  closeCartModal: () => {},
};

export function CartModalProvider({ children, bagCount = 1 }: { children: React.ReactNode; bagCount?: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const openCartModal = useCallback(() => setIsOpen(true), []);
  const closeCartModal = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeCartModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Auto-focus the first focusable button inside the modal
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeCartModal]);

  return (
    <CartModalContext.Provider value={{ openCartModal, closeCartModal }}>
      {children}
      <div
        className={isOpen ? "modal-overlay is-open" : "modal-overlay"}
        id="cart-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeCartModal();
        }}
      >
        <div
          ref={modalRef}
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="modal__icon">✓</div>
          <h2 id="modal-title" style={{ marginBottom: 8 }}>
            Added to your bag!
          </h2>
          <p>Insured shipping · Easy returns · Secure packaging</p>
          <div className="modal__actions">
            <Button href="/cart" variant="primary" full>
              View Bag ({bagCount})
            </Button>
            <Button variant="secondary" full onClick={closeCartModal}>
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    </CartModalContext.Provider>
  );
}

export function useCartModal() {
  const ctx = useContext(CartModalContext);
  return ctx ?? noopContext;
}
