/**
 * Marketing & lifestyle assets - product photography comes from /catalogue/.
 * PNGs generated per docs/image-prompts-jewelry-to-model.md (brand palette v2).
 */
export function img(filename: string): string {
  return `/images/${filename}`;
}

const staffAvatars = [
  img("staff-avatar-01.png"),
  img("staff-avatar-02.png"),
  img("staff-avatar-03.png"),
  img("staff-avatar-04.png"),
] as const;

/** Weekly hero looks stand in until lifestyle-*.png assets are added (see public/images/README.md). */
const lifestyle = {
  work: img("hero/hero-monday.png"),
  coffee: img("hero/hero-tuesday.png"),
  brunch: img("hero/hero-wednesday.png"),
  date: img("hero/hero-thursday.png"),
  travel: img("hero/hero-friday.png"),
} as const;

export const marketingImages = {
  hero: {
    main: img("hero/hero-monday.png"),
    slides: [
      img("hero/hero-monday.png"),
      img("hero/hero-tuesday.png"),
      img("hero/hero-wednesday.png"),
      img("hero/hero-thursday.png"),
      img("hero/hero-friday.png"),
      img("hero/hero-saturday.png"),
      img("hero/hero-sunday.png"),
    ],
    socialAvatars: [img("avatar-hero-social-01.png"), img("avatar-hero-social-02.png"), img("avatar-hero-social-03.png")],
  },
  categories: {
    /** Fallback only - category cards use catalogue photos via getCategoryHeroImage() */
    necklaces: img("cat-necklaces.png"),
    earrings: img("cat-earrings.png"),
    rings: img("cat-rings.png"),
    bracelets: img("cat-bracelets.png"),
    pendants: img("cat-pendants.png"),
    mangalsutra: img("cat-pendants.png"),
    cufflinks: img("cat-rings.png"),
    sets: img("cat-necklaces.png"),
    "nose-pins": img("cat-earrings.png"),
  },
  lifestyle,
  staff: {
    avatars: staffAvatars,
  },
  whyVairis: img("why_vairis_transparent.png"),
  whyVairisLanding: {
    light: img("why_vairis_transparent.png"),
    dark: img("why_vairis_transparent.png"),
  },
  videos: {
    story: img("video-thumb-story.png"),
    quality: img("video-thumb-quality.png"),
    everyday: img("video-thumb-everyday.png"),
  },
  reviews: {
    avatars: [
      img("avatar-review-01.png"),
      img("avatar-review-02.png"),
      img("avatar-review-03.png"),
      img("avatar-review-04.png"),
    ],
  },
  plp: {
    hero: img("plp-hero-necklaces.png"),
    heroByCategory: {
      necklaces: img("plp/hero-necklaces.png"),
      earrings: img("plp/hero-earrings.png"),
      rings: img("plp/hero-rings.png"),
      bracelets: img("plp/hero-bracelets.png"),
      pendants: img("plp/hero-pendants.png"),
      mangalsutra: img("plp/hero-pendants.png"),
      cufflinks: img("plp/hero-cufflinks.png"),
      sets: img("plp/hero-sets.png"),
      "nose-pins": img("plp/hero-nose-pins.png"),
    },
  },
  pdp: {
    seeIt: {
      onYou: img("pdp-see-on-you.png"),
      office: img("pdp-see-office.png"),
      daylight: img("pdp-see-daylight.png"),
      closeup: img("pdp-see-closeup.png"),
      outfit: img("pdp-see-outfit.png"),
      size: img("pdp-see-size.png"),
    },
    certificates: img("certificates-igi-bis.png"),
    founder: img("founder-poojitha.png"),
  },
  cart: {
    founders: img("founders-duo.png"),
  },
  confirmation: {
    tracking: img("tracking-phone-mockup.png"),
    igi: img("igi-certificate-card.png"),
    bis: img("bis-hallmark-seal.png"),
    founders: img("confirm-founders.png"),
    teasers: {
      ring: img("teaser-ring.png"),
      guide: img("teaser-guide-necklace.png"),
      care: img("teaser-care-box.png"),
      realWomen: img("teaser-real-women.png"),
    },
  },
  contact: {
    hero: img("contact-hero-support.png"),
    team: img("contact-concierge-team.png"),
    styling: img("contact-styling-model.png"),
  },
  returns: {
    heroOpen: img("returns-hero-care.png"),
    sealed: img("returns-eligibility-photo.png"),
    footerRings: img("returns-footer-rings.png"),
  },
} as const;

/** @deprecated Use marketingImages */
export const images = marketingImages;
