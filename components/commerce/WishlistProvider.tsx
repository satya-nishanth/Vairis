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

const WISHLIST_STORAGE_KEY = "vairis-wishlist-ids";

type WishlistContextValue = {
  ids: ReadonlySet<string>;
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => boolean;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

function loadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify([...ids]));
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIds(loadIds());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveIds(ids);
  }, [ids, hydrated]);

  const toggle = useCallback((id: string) => {
    let added = false;
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        added = false;
      } else {
        next.add(id);
        added = true;
      }
      return next;
    });
    return added;
  }, []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  const value = useMemo(
    () => ({
      ids,
      count: ids.size,
      has,
      toggle,
    }),
    [ids, has, toggle],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error("useWishlist must be used within WishlistProvider");
  }
  return ctx;
}
