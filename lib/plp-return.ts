/**
 * Remembers where the shopper was on a listing when they opened a product, so
 * Back (browser or in-app) restores the scroll position and flags that product.
 * Only a back/forward traversal restores — a fresh visit to the listing doesn't.
 */
const KEY = "plp:return";
const FRESH_MS = 30 * 60 * 1000;
const POP_WINDOW_MS = 3000;

let lastPop = 0;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    lastPop = Date.now();
  });
}

export function rememberPlpVisit(productId: string) {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ url: location.pathname + location.search, scrollY: window.scrollY, productId, at: Date.now() }),
    );
  } catch {
    /* storage unavailable — Back just won't restore */
  }
}

export function takePlpReturn(): { scrollY: number; productId: string } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const saved = JSON.parse(raw) as { url: string; scrollY: number; productId: string; at: number };
    const here = location.pathname + location.search;
    if (saved.url !== here || Date.now() - saved.at > FRESH_MS || Date.now() - lastPop > POP_WINDOW_MS) return null;
    return { scrollY: saved.scrollY, productId: saved.productId };
  } catch {
    return null;
  }
}
