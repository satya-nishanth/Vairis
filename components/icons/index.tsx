export function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconAccount() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconWishlist() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s-7-4.5-7-10a4 4 0 017-2 4 4 0 017 2c0 5.5-7 10-7 10z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6h15l-2 9H8L6 6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="9" cy="20" r="1" fill="currentColor" />
      <circle cx="18" cy="20" r="1" fill="currentColor" />
    </svg>
  );
}

const trustIcons = {
  igi: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <path
        d="M12 2l2.4 5.5L20 8.5l-4.2 3.6 1.3 5.4L12 15.2 6.9 17.5l1.3-5.4L4 8.5l5.6-.9L12 2z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.5" stroke="currentColor" />
    </svg>
  ),
  bis: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" />
      <path d="M8 12h8M12 8v8" stroke="currentColor" strokeLinecap="round" />
    </svg>
  ),
  shipping: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <path d="M3 7h11v10H3V7z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M14 10h4l3 3v4h-7v-7z" stroke="currentColor" strokeLinejoin="round" />
      <circle cx="7" cy="18" r="1.5" stroke="currentColor" />
      <circle cx="18" cy="18" r="1.5" stroke="currentColor" />
    </svg>
  ),
  secure: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  returns: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <path d="M4 7h12a4 4 0 010 8H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 4L4 7l3 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path d="M8 10h.01M12 10h.01M16 10h.01" stroke="currentColor" strokeLinecap="round" />
    </svg>
  ),
};

export const TRUST_ITEMS_FULL = [
  { label: "IGI Certified Diamonds", icon: trustIcons.igi },
  { label: "BIS Hallmarked Gold", icon: trustIcons.bis },
  { label: "Insured Shipping", icon: trustIcons.shipping },
  { label: "Secure Payments", icon: trustIcons.secure },
  { label: "Easy Returns", icon: trustIcons.returns },
  { label: "Lifetime Support", icon: trustIcons.support },
];

export const TRUST_ITEMS_COMPACT = [
  "IGI Certified Diamonds",
  "BIS Hallmarked Gold",
  "Insured Shipping",
  "Easy Returns",
  "Lifetime Support",
  "Secure Payments",
];

/** @deprecated Use utilityBarItems from @/lib/promo-bar-content */
export const UTILITY_BAR_ITEMS = [
  "100% Certified Jewellery",
  "Free Insured Shipping",
  "Easy Returns",
  "Lifetime Support",
] as const;

/** @deprecated Use announcementBarItems from @/lib/promo-bar-content */
export const ANNOUNCEMENT_BAR_ITEMS = [
  "IGI Certified Diamonds",
  "BIS Hallmarked Gold",
  "Insured Shipping",
  "Easy Returns",
  "Lifetime Support",
] as const;

/** Feature icons for Why VAIRIS / How It Works sections */
export const FEATURE_ICONS = {
  pricing: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" />
      <path d="M12 7v10M9 10h4a2 2 0 110 4h-2" stroke="currentColor" strokeLinecap="round" />
    </svg>
  ),
  transparent: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeLinecap="round" />
      <circle cx="18" cy="18" r="2" stroke="currentColor" />
    </svg>
  ),
  certified: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <path d="M12 2l2.4 5.5L20 8.5l-4.2 3.6 1.3 5.4L12 15.2 6.9 17.5l1.3-5.4L4 8.5l5.6-.9L12 2z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  ),
  everyday: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeLinecap="round" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  ),
  choose: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <path d="M6 6h15l-2 9H8L6 6z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M6 6L5 3H2" stroke="currentColor" strokeLinecap="round" />
    </svg>
  ),
  quality: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  ),
  delivery: (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden>
      <path d="M3 7h11v10H3V7z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M14 10h4l3 3v4h-7v-7z" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  ),
};
