import type { Product } from "@/lib/ui-data";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const COLOURS = ["Yellow", "White", "Rose"];

/**
 * One-line summary of the gold colours and purities across a category's products
 * (from each product's metal labels, e.g. "Yellow Gold", "18K Gold").
 */
export function goldSummary(products: Product[]): { short: string; long: string } | null {
  const metals = new Set(products.flatMap((p) => p.metals ?? []));
  const colours = COLOURS.filter((c) => metals.has(`${c} Gold`));
  const purities = [...metals]
    .map((m) => /^(\d+)K Gold$/.exec(m)?.[1])
    .filter((k): k is string => !!k)
    .map(Number)
    .sort((a, b) => a - b)
    .map((k) => `${k}K`);
  if (colours.length === 0 || purities.length === 0) return null;

  const lower = colours.map((c) => c.toLowerCase());
  const list = lower.length > 1 ? `${lower.slice(0, -1).join(", ")} & ${lower[lower.length - 1]}` : lower[0];
  const or = purities.length > 1 ? `${purities.slice(0, -1).join(", ")} or ${purities[purities.length - 1]}` : purities[0];
  return {
    short: `${colours.length === COLOURS.length ? "All gold colours" : `${cap(list)} gold`} · ${purities.join("/")}`,
    long: `Available in ${list} gold · ${or} · Made to order`,
  };
}
