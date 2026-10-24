/** Copy and links for the header menu panels (desktop mega menu and mobile drawer). */

export type NavPanelId = "rings" | "collections" | "vairis";

export type NavPanel = {
  label: string;
  eyebrow: string;
  title: [string, string];
  copy: string;
  allLabel: string;
  allHref: string;
  group: string;
  links: { label: string; href: string }[];
  chips: string[];
  feature: {
    eyebrow: string;
    title: [string, string];
    copy: string;
    image: string;
    href: string;
    cta: string;
  };
};

export const RINGS_LINKS = [
  { label: "All rings", href: "/all-products/rings" },
  { label: "Solitaire rings", href: "/all-products/rings?style=Solitaire" },
  { label: "Bands & stackables", href: "/all-products/rings?style=Band" },
];

/** Used for the Collections panel until the pinned collections load, or when none are pinned. */
export const FALLBACK_COLLECTION_LINKS = [
  { label: "Limited Edition", href: "/collections/limited-edition" },
  { label: "Gifting", href: "/collections/gifting" },
];

export const NAV_PANELS: Record<NavPanelId, NavPanel> = {
  rings: {
    label: "Rings",
    eyebrow: "A LITTLE BRILLIANCE, EVERY DAY",
    title: ["Your everyday", "signature."],
    copy: "From a quiet stack to a statement solitaire. Find the ring that feels like you.",
    allLabel: "Explore all rings",
    allHref: "/all-products/rings",
    group: "FIND YOUR STYLE",
    links: RINGS_LINKS,
    chips: ["9K gold", "14K gold", "18K gold"],
    feature: {
      eyebrow: "THE SPOTLIGHT",
      title: ["A bolder kind", "of everyday."],
      copy: "Meet the Wide Band Solitaire Ring.",
      image: "/images/nav/ring.jpg",
      href: "/product/cmpqkup4c0049uoriyn4i0hx5",
      cta: "Discover the piece",
    },
  },
  collections: {
    label: "Collections",
    eyebrow: "THOUGHTFULLY CURATED",
    title: ["For all your", "little moments."],
    copy: "Everyday favourites and meaningful gifts. Discover the edits made for your story.",
    allLabel: "Explore all collections",
    allHref: "/collections",
    group: "THE CURATED EDITS",
    links: FALLBACK_COLLECTION_LINKS,
    chips: [],
    feature: {
      eyebrow: "THE GIFTING EDIT",
      title: ["A little sparkle.", "A lot of meaning."],
      copy: "Diamond pieces made to give.",
      image: "/images/nav/bezel.jpg",
      href: "/collections/gifting",
      cta: "Explore gifting",
    },
  },
  vairis: {
    label: "The Vairis story",
    eyebrow: "THE VAIRIS WAY",
    title: ["Fine jewellery.", "Clear intentions."],
    copy: "Honest pricing, certified quality and everyday pieces that feel like you.",
    allLabel: "Get to know Vairis",
    allHref: "/about",
    group: "OUR WORLD",
    links: [
      { label: "Our story", href: "/about" },
      { label: "Why Vairis", href: "/why-vairis" },
      { label: "Our services & promises", href: "/our-services" },
      { label: "Diamond & gold certification", href: "/diamond-certification" },
      { label: "Contact us", href: "/contact" },
    ],
    chips: [],
    feature: {
      eyebrow: "DNA DIAMOND",
      title: ["A diamond with", "your story."],
      copy: "Discover DNA Diamond by Vairis.",
      image: "/images/nav/band.jpg",
      href: "/dna-diamond",
      cta: "Discover DNA Diamond",
    },
  },
};
