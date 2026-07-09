import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/images/", import.meta.url));

const GOLD = "#c9a84c";
const CREAM = "#faf6ef";
const DARK = "#2b2620";

const AVATAR_INITIALS = {
  "avatar-hero-social-01.png": "AR",
  "avatar-hero-social-02.png": "PK",
  "avatar-hero-social-03.png": "SM",
  "avatar-review-01.png": "AN",
  "avatar-review-02.png": "RV",
  "avatar-review-03.png": "KJ",
  "avatar-review-04.png": "DM",
  "staff-avatar-01.png": "VA",
  "staff-avatar-02.png": "IR",
  "staff-avatar-03.png": "IS",
  "staff-avatar-04.png": "VS",
};

const TILES = {
  "video-thumb-story.png": ["Our Story", 1280, 720],
  "video-thumb-quality.png": ["Crafted Quality", 1280, 720],
  "video-thumb-everyday.png": ["Everyday Wear", 1280, 720],
  "cat-necklaces.png": ["Necklaces", 800, 800],
  "cat-earrings.png": ["Earrings", 800, 800],
  "cat-rings.png": ["Rings", 800, 800],
  "cat-bracelets.png": ["Bracelets", 800, 800],
  "cat-pendants.png": ["Pendants", 800, 800],
  "plp-hero-necklaces.png": ["VAIRIS", 1600, 500],
  "plp/hero-necklaces.png": ["Necklaces", 1600, 500],
  "plp/hero-earrings.png": ["Earrings", 1600, 500],
  "plp/hero-rings.png": ["Rings", 1600, 500],
  "plp/hero-bracelets.png": ["Bracelets", 1600, 500],
  "plp/hero-pendants.png": ["Pendants", 1600, 500],
  "plp/hero-cufflinks.png": ["Cufflinks", 1600, 500],
  "plp/hero-sets.png": ["Sets", 1600, 500],
  "plp/hero-nose-pins.png": ["Nose Pins", 1600, 500],
  "pdp-see-on-you.png": ["On You", 800, 800],
  "pdp-see-office.png": ["At Work", 800, 800],
  "pdp-see-daylight.png": ["In Daylight", 800, 800],
  "pdp-see-closeup.png": ["Up Close", 800, 800],
  "pdp-see-outfit.png": ["Styled", 800, 800],
  "pdp-see-size.png": ["True Size", 800, 800],
  "certificates-igi-bis.png": ["IGI · BIS Certified", 1200, 600],
  "founder-poojitha.png": ["VAIRIS", 800, 1000],
  "founders-duo.png": ["VAIRIS Founders", 800, 533],
  "confirm-founders.png": ["Thank You", 800, 533],
  "tracking-phone-mockup.png": ["Order Tracking", 600, 900],
  "igi-certificate-card.png": ["IGI Certificate", 800, 500],
  "bis-hallmark-seal.png": ["BIS Hallmark", 500, 500],
  "teaser-ring.png": ["Rings", 600, 600],
  "teaser-guide-necklace.png": ["Style Guide", 600, 600],
  "teaser-care-box.png": ["Jewellery Care", 600, 600],
  "teaser-real-women.png": ["Real Stories", 600, 600],
  "contact-hero-support.png": ["We're Here to Help", 1600, 600],
  "contact-concierge-team.png": ["Concierge Team", 800, 600],
  "contact-styling-model.png": ["Styling Session", 800, 1000],
  "returns-hero-open-box.png": ["Easy Returns", 1200, 600],
  "returns-closed-sealed-box.png": ["Sealed and Insured", 800, 600],
  "returns-footer-rings.png": ["VAIRIS", 1200, 400],
};

function avatarSvg(initials, size = 192) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.9"/>
    <stop offset="100%" stop-color="#a5843a"/>
  </linearGradient></defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
    font-family="Georgia, serif" font-size="${size * 0.38}" fill="${CREAM}" letter-spacing="2">${initials}</text>
</svg>`;
}

function tileSvg(label, w, h) {
  const fs = Math.min(w, h) * 0.11;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${CREAM}"/>
    <stop offset="100%" stop-color="#efe6d5"/>
  </linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect x="${w * 0.03}" y="${h * 0.06}" width="${w * 0.94}" height="${h * 0.88}" fill="none" stroke="${GOLD}" stroke-opacity="0.45" stroke-width="2"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
    font-family="Georgia, serif" font-size="${fs}" fill="${DARK}" fill-opacity="0.75" letter-spacing="3">${label}</text>
  <text x="50%" y="${h / 2 + fs * 1.2}" dominant-baseline="middle" text-anchor="middle"
    font-family="Georgia, serif" font-size="${fs * 0.42}" fill="${GOLD}" letter-spacing="6">VAIRIS</text>
</svg>`;
}

for (const [file, initials] of Object.entries(AVATAR_INITIALS)) {
  const out = join(OUT, file);
  mkdirSync(dirname(out), { recursive: true });
  await sharp(Buffer.from(avatarSvg(initials))).png().toFile(out);
  console.log("avatar:", file);
}

for (const [file, [label, w, h]] of Object.entries(TILES)) {
  const out = join(OUT, file);
  mkdirSync(dirname(out), { recursive: true });
  await sharp(Buffer.from(tileSvg(label, w, h))).png().toFile(out);
  console.log("tile:", file);
}

console.log("done");
