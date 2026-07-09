"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createBrowserClient } from "@supabase/ssr";

export type CartVariant = {
  id: string;
  metalType: string;
  size: string | null;
  weightGrams: string;
  makingChargePerGram: string;
  flatMakingCharge: string;
  stoneCharges: string;
  miscCharges: string;
  sku: string;
  product: {
    id: string;
    name: string;
    images: string[];
    itemCode: string | null;
  };
};

export type CartLine = {
  id: string;
  variantId: string;
  quantity: number;
  variant: CartVariant;
  unitPrice: number;
};

type CartContextValue = {
  items: CartLine[];
  count: number;
  isLoggedIn: boolean;
  hydrated: boolean;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/cart");
    if (res.ok) {
      const json = (await res.json()) as CartLine[];
      setItems(json);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();

    async function init() {
      const { data } = await supabase.auth.getSession();
      const loggedIn = !!data.session;
      setIsLoggedIn(loggedIn);
      if (loggedIn) await refresh();
      setHydrated(true);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const loggedIn = !!session;
      setIsLoggedIn(loggedIn);
      if (loggedIn) refresh();
      else setItems([]);
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const addItem = useCallback(
    async (variantId: string, quantity = 1) => {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity }),
      });
      await refresh();
    },
    [refresh],
  );

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity } : i)));
    await fetch(`/api/cart/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    await fetch(`/api/cart/${itemId}`, { method: "DELETE" });
  }, []);

  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  const value = useMemo(
    () => ({ items, count, isLoggedIn, hydrated, addItem, updateQuantity, removeItem }),
    [items, count, isLoggedIn, hydrated, addItem, updateQuantity, removeItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
