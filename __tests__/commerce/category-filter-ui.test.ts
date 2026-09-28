import type { Product } from "@/lib/ui-data";

// Extracted filter logic identical to CategoryPageView for unit testing
function filterProducts(
  products: Product[],
  filters: { sort: string; styles: string[]; metals: string[]; readyToShip: boolean },
  labelProductMap?: Record<string, string[]>
): Product[] {
  let result = [...products];

  if (filters.metals.length > 0) {
    result = result.filter((p) => p.metals?.some((m) => filters.metals.includes(m)));
  }

  if (filters.styles.length > 0) {
    const wanted = filters.styles.map((s) => s.toLowerCase());
    result = result.filter((p) => {
      // 1. Explicitly mapped label check
      const isExplicitlyTagged = filters.styles.some((label) => {
        const mapped = labelProductMap?.[label];
        return (
          mapped &&
          (mapped.includes(p.slug) ||
            mapped.includes(p.sku ?? "") ||
            (p.catalogueId && mapped.includes(p.catalogueId)))
        );
      });
      if (isExplicitlyTagged) return true;

      // 2. Keyword/style match across product attributes
      const text = [
        p.styleText ?? "",
        p.description ?? "",
        p.name ?? "",
        p.sku ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return wanted.some((s) => text.includes(s));
    });
  }

  if (filters.readyToShip) {
    result = result.filter((p) => p.inStock);
  }

  return result;
}

const mockProducts: Product[] = [
  {
    slug: "p1",
    sku: "V-RNG-01",
    name: "Classic Solitaire Diamond Ring",
    category: "rings",
    image: "/img1.jpg",
    images: ["/img1.jpg"],
    catalogueId: "c1",
    styleText: "solitaire round brilliant diamond everyday wear",
    metals: ["Yellow Gold", "18K Gold"],
    inStock: true,
  },
  {
    slug: "p2",
    sku: "V-RNG-02",
    name: "Vintage Floral Band",
    category: "rings",
    image: "/img2.jpg",
    images: ["/img2.jpg"],
    catalogueId: "c2",
    styleText: "floral vintage stackable band",
    metals: ["Rose Gold"],
    inStock: false,
  },
  {
    slug: "p3",
    sku: "V-RNG-03",
    name: "Modern Cocktail Statement Ring",
    category: "rings",
    image: "/img3.jpg",
    images: ["/img3.jpg"],
    catalogueId: "c3",
    styleText: "cocktail statement party wear",
    metals: ["White Gold"],
    inStock: true,
  },
];

describe("Storefront Category Filtering by Labels", () => {
  it("filters products by text-matching custom label", () => {
    const filtered = filterProducts(
      mockProducts,
      { sort: "popular", styles: ["Cocktail"], metals: [], readyToShip: false },
      {}
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sku).toBe("V-RNG-03");
  });

  it("filters products by explicit labelProductMap assignment", () => {
    // Map "Special Edition" label explicitly to p2 even though text doesn't contain it
    const labelProductMap = {
      "Special Edition": ["p2"],
    };

    const filtered = filterProducts(
      mockProducts,
      { sort: "popular", styles: ["Special Edition"], metals: [], readyToShip: false },
      labelProductMap
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].slug).toBe("p2");
  });

  it("combines style label and metal filters", () => {
    const filtered = filterProducts(
      mockProducts,
      { sort: "popular", styles: ["Solitaire"], metals: ["Yellow Gold"], readyToShip: false },
      {}
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sku).toBe("V-RNG-01");

    const noMatch = filterProducts(
      mockProducts,
      { sort: "popular", styles: ["Solitaire"], metals: ["Rose Gold"], readyToShip: false },
      {}
    );
    expect(noMatch).toHaveLength(0);
  });
});
