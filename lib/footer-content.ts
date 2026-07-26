import { CATEGORY_LABELS, HEADER_NAV_CATEGORIES, categoryHref, type ShopCategory } from "@/lib/catalogue-ui";

export const footerTrustItems = [
  {
    label: "100% Certified Jewellery",
    icon: { name: "certified_jewellery_seal", category: "brand" as const },
  },
  {
    label: "Secure Payments",
    icon: { name: "secure_payments", category: "brand" as const },
  },
  {
    label: "Easy Returns",
    icon: { name: "easy_returns", category: "brand" as const },
  },
  {
    label: "Lifetime Support",
    icon: { name: "lifetime_support", category: "brand" as const },
  },
] as const;

export const footerShopLinks = [
  { label: "All Jewellery", href: categoryHref("necklaces") },
  ...HEADER_NAV_CATEGORIES.map((slug: ShopCategory) => ({
    label: CATEGORY_LABELS[slug].title,
    href: categoryHref(slug),
  })),
] as const;

export const footerHelpLinks = [
  { label: "FAQ", href: "/contact" },
  { label: "Shipping & Delivery", href: "/policies/shipping" },
  { label: "Returns", href: "/returns" },
  { label: "Care Guide", href: "/contact" },
  { label: "Track Order", href: "/track-order" },
  { label: "Contact Us", href: "/contact" },
] as const;

export const footerLegalLinks = [
  { label: "Privacy Policy", href: "/policies/privacy" },
  { label: "Terms of Service", href: "/policies/terms" },
  { label: "Shipping Policy", href: "/policies/shipping" },
  { label: "Refund & Return Policy", href: "/policies/refund" },
] as const;

export const footerAboutLinks = [
  { label: "Our Story", href: "/contact" },
  { label: "Why Vairis", href: "/#why" },
  { label: "Reviews", href: "/#reviews" },
  { label: "Blog", href: "#" },
  { label: "Careers", href: "#" },
] as const;

export const footerSocialLinks = [
  { label: "Instagram", href: "https://www.instagram.com/vairis/", icon: "instagram" },
  { label: "Facebook", href: "https://www.facebook.com/vairis/", icon: "facebook" },
  { label: "Pinterest", href: "https://www.pinterest.com/vairis/", icon: "pinterest" },
  { label: "YouTube", href: "https://www.youtube.com/@vairis", icon: "youtube" },
  { label: "TikTok", href: "https://www.tiktok.com/@vairis", icon: "tiktok" },
] as const;
