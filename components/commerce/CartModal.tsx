"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Button } from "@/components/ui/Button";

type CartModalContextValue = {
  openCartModal: () => void;
  closeCartModal: () => void;
};

const CartModalContext = createContext<CartModalContextValue | null>(null);

export function CartModalProvider({ children, bagCount = 1 }: { children: React.ReactNode; bagCount?: number }) {
  const [isOpen, setIsOpen] = useState(false);

  const openCartModal = useCallback(() => setIsOpen(true), []);
  const closeCartModal = useCallback(() => setIsOpen(false), []);

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
        <div className="modal" role="dialog" aria-labelledby="modal-title">
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
  if (!ctx) throw new Error("useCartModal must be used within CartModalProvider");
  return ctx;
}

export function OpenCartModalButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { openCartModal } = useCartModal();
  return (
    <button type="button" className={className} onClick={openCartModal}>
      {children}
    </button>
  );
}
