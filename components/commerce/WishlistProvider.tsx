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

const LOCAL_KEY = "vairis-wishlist-ids";

type WishlistContextValue = {
  ids: ReadonlySet<string>;
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => boolean;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

function loadLocal(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveLocal(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify([...ids]));
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    async function init() {
      const { data } = await supabase.auth.getSession();
      const loggedIn = !!data.session;
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
        const res = await fetch("/api/wishlist");
        if (res.ok) {
          const json = (await res.json()) as { productId: string }[];
          setIds(new Set(json.map((w) => w.productId)));
        }
      } else {
        setIds(loadLocal());
      }
      setHydrated(true);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (hydrated && !isLoggedIn) saveLocal(ids);
  }, [ids, hydrated, isLoggedIn]);

  const toggle = useCallback(
    (id: string) => {
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
      if (isLoggedIn) {
        fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: id }),
        }).catch(console.error);
      }
      return added;
    },
    [isLoggedIn],
  );

  const has = useCallback((id: string) => ids.has(id), [ids]);
  const value = useMemo(
    () => ({ ids, count: ids.size, has, toggle }),
    [ids, has, toggle],
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
