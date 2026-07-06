import manifest from "@/data/catalogue-manifest.json";

export type ProductCategory =
  | "necklaces"
  | "earrings"
  | "rings"
  | "bracelets"
  | "pendants"
  | "cufflinks"
  | "sets"
  | "nose-pins"
  | "other";

export type CatalogueProduct = {
  id: string;
  sku: string;
  prefix: string;
  typeToken: string | null;
  styleSuffix: string | null;
  category: ProductCategory;
  slug: string;
  folder: string;
  categoryFolder: string;
  images: string[];
  primaryImage: string | null;
  video: string | null;
};

export type CatalogueManifest = {
  generatedAt: string;
  source?: "local" | "google-drive";
  catalogueRoot?: string;
  totalProducts: number;
  byCategory: Record<string, string[]>;
  products: CatalogueProduct[];
};

export const catalogue = manifest as CatalogueManifest;

export const catalogueProducts = catalogue.products;

export function getProductsByCategory(category: ProductCategory): CatalogueProduct[] {
  return catalogueProducts.filter((p) => p.category === category);
}

export function getProductBySlug(slug: string): CatalogueProduct | undefined {
  return catalogueProducts.find((p) => p.slug === slug);
}

export function getProductByFolder(folder: string): CatalogueProduct | undefined {
  return catalogueProducts.find((p) => p.folder === folder || p.id === folder);
}

/** First catalogue product in category - for category cards / PLP heroes */
export function getCategoryHeroImage(category: ProductCategory): string | null {
  const product = getProductsByCategory(category)[0];
  return product?.primaryImage ?? null;
}

/** Rotating preview images for homepage category cards */
export function getCategoryPreviewImages(category: ProductCategory, limit = 6): string[] {
  return getProductsByCategory(category)
    .map((p) => p.primaryImage ?? p.images[0] ?? null)
    .filter((src): src is string => Boolean(src))
    .slice(0, limit);
}

/** Featured products for homepage / PLP grid (real catalogue, not placeholders) */
export function getFeaturedProducts(limit = 8): CatalogueProduct[] {
  const preferred = [
    "AJC03112NL_NE REG",
    "AJBB0791PD_P HAN",
    "AJBB0616LR_RP 3.03",
    "AJBB0561BR_BR REG",
  ];

  const picked = preferred
    .map((id) => getProductByFolder(id))
    .filter((p): p is CatalogueProduct => Boolean(p));

  if (picked.length >= limit) return picked.slice(0, limit);

  const rest = catalogueProducts.filter((p) => !picked.some((x) => x.id === p.id));
  return [...picked, ...rest].slice(0, limit);
}

export const CATEGORY_LABELS: Record<ProductCategory, { title: string; description: string; intro: string; emotional: string }> = {
  necklaces: {
    title: "Necklaces",
    description: "Minimal & Elegant",
    intro: "Minimal diamonds designed for workdays, dinners and everyday confidence.",
    emotional: "A soft glow at your collarbone - the piece you reach for when you want to feel like yourself.",
  },
  earrings: {
    title: "Earrings",
    description: "Everyday Sparkle",
    intro: "Delicate studs and drops made for coffee runs, meetings and evenings out.",
    emotional: "Small sparks of light that follow you from morning meetings to evening plans.",
  },
  rings: {
    title: "Rings",
    description: "Stackable & Chic",
    intro: "Stackable bands and solitaires designed for everyday wear, not just occasions.",
    emotional: "The quiet sparkle on your hand that turns ordinary mornings into moments you choose yourself.",
  },
  bracelets: {
    title: "Bracelets",
    description: "Delicate Layers",
    intro: "Light tennis and chain bracelets that layer beautifully for any day.",
    emotional: "A gentle circle of light on your wrist - movement, mood, and everyday rhythm.",
  },
  pendants: {
    title: "Pendants",
    description: "Timeless Pieces",
    intro: "Timeless solitaires on fine chains - your everyday signature piece.",
    emotional: "One diamond close to your heart - your signature for every version of the day.",
  },
  cufflinks: {
    title: "Cufflinks",
    description: "Refined Details",
    intro: "Diamond cufflinks for polished everyday and occasion dressing.",
    emotional: "Refined details that say you care about the small things - because they matter.",
  },
  sets: {
    title: "Sets",
    description: "Curated Pairs",
    intro: "Matching necklace and earring sets designed to wear together.",
    emotional: "Pieces that belong together - effortless harmony for days when you want to feel pulled-together.",
  },
  "nose-pins": {
    title: "Nose Pins",
    description: "Subtle Sparkle",
    intro: "Minimal diamond nose pins for everyday elegance.",
    emotional: "A whisper of sparkle - personal, subtle, and entirely yours.",
  },
  other: {
    title: "Jewellery",
    description: "Discover VAIRIS",
    intro: "Explore minimal diamond jewellery designed for real life.",
    emotional: "Diamonds that fit real life - not just the occasions you dress up for.",
  },
};

export const SHOP_CATEGORIES = [
  "necklaces",
  "earrings",
  "rings",
  "bracelets",
  "pendants",
  "cufflinks",
  "sets",
  "nose-pins",
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

/** Categories shown in the main site header nav - edit this list to change header links. */
export const HEADER_NAV_CATEGORIES = [
  "necklaces",
  "earrings",
  "rings",
  "bracelets",
  "pendants",
] as const satisfies readonly ShopCategory[];

/** Top products for PLP hero carousel */
export function getTopCategoryProducts(category: ProductCategory, limit = 8): CatalogueProduct[] {
  return getProductsByCategory(category).slice(0, limit);
}

export const PLP_FILTER_GROUPS: Record<
  ShopCategory,
  { id: "styles" | "metals"; title: string; options: string[] }[]
> = {
  rings: [
    {
      id: "styles",
      title: "Style",
      options: ["Solitaire", "Stackable", "Band", "Everyday Wear", "Office Wear", "Gifting"],
    },
    {
      id: "metals",
      title: "Metal",
      options: ["Yellow Gold", "White Gold", "Rose Gold", "18K Gold"],
    },
  ],
  necklaces: [
    {
      id: "styles",
      title: "Style",
      options: ["Solitaire", "Layering", "Minimal", "Office Wear", "Everyday Wear"],
    },
    { id: "metals", title: "Metal", options: ["Yellow Gold", "White Gold", "Rose Gold"] },
  ],
  earrings: [
    {
      id: "styles",
      title: "Style",
      options: ["Studs", "Drops", "Hoops", "Everyday Wear", "Office Wear"],
    },
    { id: "metals", title: "Metal", options: ["Yellow Gold", "White Gold", "Rose Gold"] },
  ],
  bracelets: [
    { id: "styles", title: "Style", options: ["Tennis", "Chain", "Layering", "Minimal"] },
    { id: "metals", title: "Metal", options: ["Yellow Gold", "White Gold", "Rose Gold"] },
  ],
  pendants: [
    { id: "styles", title: "Style", options: ["Solitaire", "Minimal", "Everyday Wear", "Gifting"] },
    { id: "metals", title: "Metal", options: ["Yellow Gold", "White Gold", "Rose Gold"] },
  ],
  cufflinks: [
    { id: "styles", title: "Style", options: ["Classic", "Modern", "Gifting"] },
    { id: "metals", title: "Metal", options: ["Yellow Gold", "White Gold"] },
  ],
  sets: [
    { id: "styles", title: "Style", options: ["Necklace & Earrings", "Bridal", "Gifting"] },
    { id: "metals", title: "Metal", options: ["Yellow Gold", "White Gold", "Rose Gold"] },
  ],
  "nose-pins": [
    { id: "styles", title: "Style", options: ["Stud", "Minimal", "Everyday Wear"] },
    { id: "metals", title: "Metal", options: ["Yellow Gold", "White Gold"] },
  ],
};

export const PLP_PAGE_SIZE = 20;

/** Max product rows shown per page in PDP "You may also like" before pagination. */
export const PDP_RELATED_MAX_ROWS = 5;

/** PLP mobile page size: 2 columns × max rows. */
export const PLP_MOBILE_PAGE_SIZE = PDP_RELATED_MAX_ROWS * 2;

export function isShopCategory(slug: string): slug is ShopCategory {
  return (SHOP_CATEGORIES as readonly string[]).includes(slug);
}

const ALL_PRODUCTS_BASE = "/all-products";

export function categoryHref(category: ProductCategory): string {
  return `${ALL_PRODUCTS_BASE}/${category}`;
}

/** Legacy `/category-{slug}` path (pre–all-products route). */
export function legacyCategoryHref(category: ProductCategory): string {
  return `/category-${category}`;
}
