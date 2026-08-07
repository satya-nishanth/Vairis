import { marketingImages } from "@/lib/images";

export const whyVairisFeatures = [
  {
    icon: { name: "no_showroom_markups", category: "brand" as const },
    title: "No Showroom Costs",
    description: "You pay for jewelry, not overheads.",
  },
  {
    icon: { name: "transparent_pricing", category: "brand" as const },
    title: "Transparent Pricing",
    description: "Honest prices. Always.",
  },
  {
    icon: { name: "igi_certified", category: "brand" as const },
    title: "Certified & Authentic",
    description: "IGI diamonds & BIS hallmarked gold.",
  },
  {
    icon: { name: "made_for_everyday", category: "brand" as const },
    title: "Made for Everyday",
    description: "Jewellery that fits your everyday life.",
  },
  {
    icon: { name: "lifetime_support", category: "brand" as const },
    title: "Easy Returns & Lifetime Support",
    description: "Hassle-free returns and lifetime care.",
  },
] as const;

export const founderVideos = [
  {
    src: marketingImages.videos.story,
    title: "Our Story",
    description: "Why we started Vairis",
    placeholder: "Founder video - Our Story",
  },
  {
    src: marketingImages.videos.everyday,
    title: "Diamonds for Everyday",
    description: "Our belief in everyday wear",
    placeholder: "Founder video - Everyday wear",
  },
  {
    src: marketingImages.videos.quality,
    title: "Behind Vairis",
    description: "Design, quality and transparency",
    placeholder: "Founder video - Behind Vairis",
  },
] as const;

export const howItWorksSteps = [
  {
    icon: { name: "shopping_bag", category: "navigation" as const },
    title: "Choose Your Jewellery",
    description: "Browse minimal designs made for real life.",
  },
  {
    icon: { name: "quality_check", category: "brand" as const },
    title: "Certified & Quality Checked",
    description: "Every piece is IGI certified and inspected.",
  },
  {
    icon: { name: "insured_shipping", category: "brand" as const },
    title: "Insured Delivery",
    description: "Secure, tamper-proof packaging to your door.",
  },
  {
    icon: { name: "easy_returns", category: "brand" as const },
    title: "Easy Returns & Lifetime Support",
    description: "Hassle-free returns and lifetime care.",
  },
] as const;
