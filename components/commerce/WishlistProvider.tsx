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
  isLoggedIn: boolean;
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
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore storage quota errors
  }
}

async function syncWithServer(localIds: Set<string>): Promise<Set<string>> {
  try {
    const res = await fetch("/api/wishlist");
    if (!res.ok) return localIds;
    const json = (await res.json()) as { productId: string }[];
    const serverIds = new Set(json.map((w) => w.productId));

    // Any items saved locally that aren't on the server get synced to the server:
    for (const localId of localIds) {
      if (!serverIds.has(localId)) {
        serverIds.add(localId);
        fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: localId }),
        }).catch(console.error);
      }
    }
    return serverIds;
  } catch {
    return localIds;
  }
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

      const local = loadLocal();
      if (loggedIn) {
        const merged = await syncWithServer(local);
        setIds(merged);
        saveLocal(merged);
      } else {
        setIds(local);
      }
      setHydrated(true);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      const loggedIn = !!session;
      setIsLoggedIn(loggedIn);

      if (event === "SIGNED_IN" && session) {
        const local = loadLocal();
        const merged = await syncWithServer(local);
        setIds(merged);
        saveLocal(merged);
      } else if (event === "SIGNED_OUT") {
        // Keep the items wishlisted on this device so the user still sees their wishlist
        const local = loadLocal();
        setIds(local);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (hydrated) {
      saveLocal(ids);
    }
  }, [ids, hydrated]);

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
        saveLocal(next);
        return next;
      });
      if (isLoggedIn) {
        if (added) {
          fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: id }),
          }).catch(console.error);
        } else {
          fetch(`/api/wishlist?productId=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(console.error);
        }
      }
      return added;
    },
    [isLoggedIn],
  );

  const has = useCallback((id: string) => ids.has(id), [ids]);
  const value = useMemo(
    () => ({ ids, count: ids.size, isLoggedIn, has, toggle }),
    [ids, isLoggedIn, has, toggle],
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
