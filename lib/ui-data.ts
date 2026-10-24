import type { CatalogueProduct, ProductCategory } from "./catalogue-ui";
import {
  CATEGORY_LABELS,
  getCategoryHeroImage,
  getCategoryPreviewImages,
  getFeaturedProducts,
  getProductBySlug,
  getProductsByCategory,
  SHOP_CATEGORIES,
  STOCKED_CATEGORIES,
} from "./catalogue-ui";
import { marketingImages } from "./images";
import { productHoverImage } from "./product-media";

export type Product = {
  slug: string;
  sku: string;
  name: string;
  description?: string;
  price?: number;
  image: string;
  /** Optional PLP hover swap image (slot 7); never used as primary/face. */
  hoverImage?: string | null;
  images: string[];
  category: ProductCategory;
  badge?: string;
  meta?: string;
  catalogueId: string;
  video?: string | null;
  /** Prisma ProductVariant id for real add-to-cart; absent on mock catalogue data */
  variantId?: string;
  /** Human metal labels across variants (e.g. "18K Gold", "Rose Gold") — PLP filters */
  metals?: string[];
  /** Free-text style/design descriptors — PLP style filter matches substrings */
  styleText?: string;
  /** Any variant in stock — PLP "Ready to Ship" filter */
  inStock?: boolean;
  /** Price intentionally not shown (admin pricing-visibility setting) — distinct
   * from `price` simply being unavailable (e.g. no gold rate configured yet). */
  priceHidden?: boolean;
  /** Whether the product has multiple variants with differing prices (PLP shows "From ₹...") */
  hasMultiplePrices?: boolean;
  /** Active automatic discount % for badge / strikethrough (display-only). */
  autoDiscountPercent?: number;
  /** PLP filter tags (admin-assigned) */
  types?: string[];
  occasions?: string[];
  /** ISO date — "New arrivals" sort */
  createdAt?: string;
  /** Stone shape — PLP Shape filter */
  shape?: string | null;
  /** Units sold in the ranking window — Bestsellers sort; null = never sold */
  salesRank?: number | null;
};

const CATEGORY_DESCRIPTIONS: Partial<Record<ProductCategory, string>> = {
  necklaces: "Minimal sparkle for daily outfits",
  earrings: "Delicate everyday studs and drops",
  rings: "Stackable bands for everyday wear",
  bracelets: "Light layers for wrist",
  pendants: "Timeless solitaires on fine chains",
  cufflinks: "Refined diamond details for him",
  sets: "Curated matching necklace and earring sets",
  "nose-pins": "Subtle everyday nose pin sparkle",
};

export function catalogueToProduct(item: CatalogueProduct, index = 0): Product {
  const label = CATEGORY_LABELS[item.category]?.title ?? "Jewellery";
  return {
    slug: item.slug,
    sku: item.sku,
    name: `${item.sku} ${label.replace(/s$/, "")}`,
    description: CATEGORY_DESCRIPTIONS[item.category],
    image: item.primaryImage ?? item.images[0] ?? "",
    hoverImage: productHoverImage(item.images),
    images: item.images,
    category: item.category,
    catalogueId: item.id,
    video: item.video ?? null,
    badge: index === 0 ? "Best Seller" : index === 1 ? "New" : undefined,
    meta: "Insured Delivery",
  };
}

/** PLP / homepage grid - from real catalogue */
export const products: Product[] = getFeaturedProducts(8).map(catalogueToProduct);

/** All products in a shop category */
export function getCategoryProducts(category: ProductCategory): Product[] {
  return getProductsByCategory(category).map(catalogueToProduct);
}

export function getProduct(slug: string): Product | undefined {
  const item = getProductBySlug(slug);
  return item ? catalogueToProduct(item) : undefined;
}

export const categories = STOCKED_CATEGORIES.map((slug) => {
  const previewImages = getCategoryPreviewImages(slug);
  const heroImage = getCategoryHeroImage(slug) ?? marketingImages.categories[slug];

  return {
    slug,
    title: CATEGORY_LABELS[slug].title,
    description: CATEGORY_LABELS[slug].description,
    image: heroImage,
    images: previewImages.length > 0 ? previewImages : [heroImage],
    count: getProductsByCategory(slug).length,
  };
});

export const testimonials = [
  {
    quote: "Finally, jewellery that I can wear to office daily!",
    name: "Ritika",
    city: "Mumbai",
    avatar: marketingImages.reviews.avatars[0],
  },
  {
    quote: "The quality and packaging blew me away.",
    name: "Neha",
    city: "Pune",
    avatar: marketingImages.reviews.avatars[1],
  },
  {
    quote: "Perfect for everyday wear. So minimal and elegant!",
    name: "Ananya",
    city: "Bengaluru",
    avatar: marketingImages.reviews.avatars[2],
  },
  {
    quote: "Loved the experience from start to finish.",
    name: "Sneha",
    city: "Hyderabad",
    avatar: marketingImages.reviews.avatars[3],
  },
];

export const lifestyleScenes = [
  { id: "work", label: "At Work", image: marketingImages.lifestyle.work, ugcLabel: "Office look @ananya.work" },
  { id: "coffee", label: "Coffee Runs", image: marketingImages.lifestyle.coffee, ugcLabel: "Coffee dates @thechicdiaries" },
  { id: "brunch", label: "Weekend Brunch", image: marketingImages.lifestyle.travel, ugcLabel: "Weekend brunch" },
  { id: "date", label: "Date Night", image: marketingImages.lifestyle.date, ugcLabel: "Evening out @stylebyriya" },
  { id: "travel", label: "Travel Days", image: marketingImages.lifestyle.brunch, ugcLabel: "Travel days" },
];

export const seeItShots = [
  { label: "On You", image: marketingImages.pdp.seeIt.onYou },
  { label: "Office Wear", image: marketingImages.pdp.seeIt.office },
  { label: "Daylight Look", image: marketingImages.pdp.seeIt.daylight },
  { label: "Close-up", image: marketingImages.pdp.seeIt.closeup },
  { label: "With Outfit", image: marketingImages.pdp.seeIt.outfit },
  { label: "Size Reference", image: marketingImages.pdp.seeIt.size },
];

/** Default featured necklace PDP */
export const FEATURED_PRODUCT_SLUG = getFeaturedProducts(1)[0]?.slug ?? "ajc03112nl-ne-reg";

/** Hero carousel - weekly lifestyle looks (Mon–Sun) */
export function getHeroSlides(): readonly string[] {
  return marketingImages.hero.slides;
}

export const formatPrice = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

export const WHATSAPP_URL = "https://wa.me/917075486464";
export const WHATSAPP_CONSULTATION_URL = `${WHATSAPP_URL}?text=Hi%20VAIRIS%2C%20I%27d%20like%20to%20book%20a%20consultation%20call.`;
export const WHATSAPP_SIZING_URL = `${WHATSAPP_URL}?text=Hi%20VAIRIS%2C%20I%20need%20help%20finding%20my%20ring%20size.`;
export const WHATSAPP_STYLING_URL = `${WHATSAPP_URL}?text=Hi%20VAIRIS%2C%20I%27d%20like%20to%20start%20a%20personal%20styling%20session.`;
