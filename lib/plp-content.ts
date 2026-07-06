import { WHATSAPP_URL } from "@/lib/ui-data";

/** Trust cards beside the help panel on PLP and PDP. */
export const plpTrustItems = [
  {
    icon: { name: "no_showroom_markups", category: "brand" as const },
    label: "No Showroom Markups",
    description: "Luxury without the extra cost.",
  },
  {
    icon: { name: "transparent_pricing", category: "brand" as const },
    label: "Transparent Pricing",
    description: "What you see is what you pay.",
  },
  {
    icon: { name: "igi_certified", category: "brand" as const },
    label: "IGI Certified Diamonds",
    description: "Certified brilliance you can trust.",
  },
  {
    icon: { name: "bis_hallmark", category: "brand" as const },
    label: "BIS Hallmarked Gold",
    description: "Assured purity. Assured trust.",
  },
  {
    icon: { name: "insured_shipping", category: "brand" as const },
    label: "Insured Shipping",
    description: "Secure delivery, every time.",
  },
  {
    icon: { name: "easy_returns", category: "brand" as const },
    label: "Easy Returns",
    description: "Hassle-free returns, simple and quick.",
  },
  {
    icon: { name: "lifetime_support", category: "brand" as const },
    label: "Lifetime Support",
    description: "We're here for you, always.",
  },
] as const;

export const plpTrustItemsPrimary = plpTrustItems.slice(0, 4);
export const plpTrustItemsSecondary = plpTrustItems.slice(4);

export const plpHelpLinks = [
  {
    title: "Chat on WhatsApp",
    subtext: "Get quick answers.",
    href: WHATSAPP_URL,
    icon: { shared: true as const, name: "whatsapp_logo", category: "social" as const },
  },
  {
    title: "Book a Video Call",
    subtext: "Talk to an expert.",
    href: "/contact",
    icon: { name: "video_call_camera", category: "social" as const },
  },
  {
    title: "Style & Size Guide",
    subtext: "Find your perfect match.",
    href: "/contact",
    icon: { name: "ring_sizing_guide", category: "commerce" as const },
  },
] as const;
