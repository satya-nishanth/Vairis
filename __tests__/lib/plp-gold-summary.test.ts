import { goldSummary } from "@/lib/plp-gold-summary";
import type { Product } from "@/lib/ui-data";

const withMetals = (...metals: string[]) => ({ metals }) as Product;

describe("goldSummary", () => {
  it("summarises colours and purities across products", () => {
    const s = goldSummary([
      withMetals("Yellow Gold", "18K Gold"),
      withMetals("White Gold", "Rose Gold", "14K Gold", "9K Gold"),
    ]);
    expect(s).toEqual({
      short: "All gold colours · 9K/14K/18K",
      long: "Available in yellow, white & rose gold · 9K, 14K or 18K · Made to order",
    });
  });

  it("lists only the colours that exist", () => {
    expect(goldSummary([withMetals("Yellow Gold", "White Gold", "18K Gold")])).toEqual({
      short: "Yellow & white gold · 18K",
      long: "Available in yellow & white gold · 18K · Made to order",
    });
  });

  it("returns null without metal data", () => {
    expect(goldSummary([withMetals()])).toBeNull();
    expect(goldSummary([])).toBeNull();
  });
});
