export type PromoBarVariant = "utility" | "announcement" | "none";
export type HeaderVariant = "full" | "standard" | "minimal" | "checkout";
export type TrustBarVariant = "full" | "compact" | "none";
export type FooterVariant = "full" | "compact" | "minimal";

export type PageLayoutConfig = {
  promoBar: PromoBarVariant;
  header: HeaderVariant;
  trustBar: TrustBarVariant;
  footer: FooterVariant;
  whatsapp?: string | false;
  cartCount?: number;
};

export const pageLayouts = {
  home: {
    promoBar: "none",
    header: "standard",
    trustBar: "none",
    footer: "full",
    whatsapp: false,
  },
  plp: {
    promoBar: "announcement",
    header: "full",
    trustBar: "none",
    footer: "full",
    whatsapp: "Contact us",
    cartCount: 2,
  },
  pdp: {
    promoBar: "announcement",
    header: "full",
    trustBar: "none",
    footer: "full",
    whatsapp: "Contact us",
    cartCount: 2,
  },
  cart: {
    promoBar: "utility",
    header: "full",
    trustBar: "none",
    footer: "full",
    whatsapp: "Contact us",
    cartCount: 2,
  },
  checkout: {
    promoBar: "none",
    header: "checkout",
    trustBar: "none",
    footer: "minimal",
  },
  confirmation: {
    promoBar: "utility",
    header: "minimal",
    trustBar: "none",
    footer: "minimal",
    cartCount: 1,
  },
  contact: {
    promoBar: "utility",
    header: "full",
    trustBar: "none",
    footer: "full",
    whatsapp: "Contact us",
    cartCount: 2,
  },
  returns: {
    promoBar: "utility",
    header: "minimal",
    trustBar: "none",
    footer: "minimal",
    cartCount: 2,
  },
  wishlist: {
    promoBar: "utility",
    header: "full",
    trustBar: "none",
    footer: "full",
    whatsapp: "Contact us",
    cartCount: 2,
  },
} satisfies Record<string, PageLayoutConfig>;
