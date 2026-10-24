/**
 * Remembers where the shopper was on a listing when they opened a product, so
 * Back (browser or in-app) restores the scroll position.
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

export function rememberPlpVisit() {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ url: location.pathname + location.search, scrollY: window.scrollY, at: Date.now() }),
    );
  } catch {
    /* storage unavailable — Back just won't restore */
  }
}

export function takePlpReturn(): number | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const saved = JSON.parse(raw) as { url: string; scrollY: number; at: number };
    const here = location.pathname + location.search;
    if (saved.url !== here || Date.now() - saved.at > FRESH_MS || Date.now() - lastPop > POP_WINDOW_MS) return null;
    return saved.scrollY;
  } catch {
    return null;
  }
}
