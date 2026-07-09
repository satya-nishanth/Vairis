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
  },
  pdp: {
    promoBar: "announcement",
    header: "full",
    trustBar: "none",
    footer: "full",
    whatsapp: "Contact us",
  },
  cart: {
    promoBar: "utility",
    header: "full",
    trustBar: "none",
    footer: "full",
    whatsapp: "Contact us",
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
  },
  contact: {
    promoBar: "utility",
    header: "full",
    trustBar: "none",
    footer: "full",
    whatsapp: "Contact us",
  },
  returns: {
    promoBar: "utility",
    header: "minimal",
    trustBar: "none",
    footer: "minimal",
  },
  wishlist: {
    promoBar: "utility",
    header: "full",
    trustBar: "none",
    footer: "full",
    whatsapp: "Contact us",
  },
} satisfies Record<string, PageLayoutConfig>;
