# Banners v2 — Total Content Control

Goal: **every marketing surface on the site is admin-controlled** — not just the text/image of
a banner, but **how many** items a surface shows and **in what order**. Zero code deploys for
content changes.

Current state (v1, shipped): 7 fixed single-value slots (promo-bar, home-hero,
5 × plp-hero). One row per slot, no lists, no ordering. This plan supersedes it.

---

## 1. Core model change: slots → ordered groups

One uniform concept: a **group** = named surface holding an **ordered list** of banner items.
Single-item surfaces are just groups the renderer reads one item from. Same admin UI, same
API, same mental model everywhere.

```prisma
model SiteBanner {
  id        String   @id @default(cuid())
  group     String              // e.g. "home-hero-slides", "promo-bar"
  sortOrder Int      @default(0) // admin-controlled position within the group
  active    Boolean  @default(true)
  title     String?
  subtitle  String?
  imageUrl  String?
  linkUrl   String?
  ctaLabel  String?
  updatedAt DateTime @updatedAt

  @@index([group, sortOrder])
}
```

Migration from v1: drop the `slot` unique constraint, rename `slot` → `group`, add
`sortOrder=0`. Existing rows keep working (each old slot becomes a 1-item group).

**Read path** (`lib/site-content.ts`):
- `getBannerGroup(group): BannerContent[]` — active items, `sortOrder` asc
- `getBanner(group): BannerContent | null` — first item (convenience for single surfaces)
- Client trees: `/api/content/[group]` returns the ordered list; `useBannerGroup(group)` hook
- **Fallback rule unchanged and non-negotiable:** group empty/inactive → the built-in
  hard-coded content renders. Admin can never blank a page.

**Group registry** (`KNOWN_GROUPS`): each entry declares `group`, `description`,
`maxItems` (null = unlimited), and `fields` (which of title/subtitle/image/link/cta the
surface actually uses — the admin form only shows those, so no dead inputs).

## 2. Complete surface inventory — every banner, everywhere

### Global chrome
| Group | List? | Controls |
|-------|-------|----------|
| `promo-bar` | ✅ ordered list | N rotating/marquee messages, each: text + optional link. Count & order = admin |
| `trust-bar` | ✅ ordered list | The "IGI Certified · BIS Hallmarked · …" strip items |
| `footer-badges` | ✅ ordered list | Newsletter-section badges (certified/secure/returns/support) |

### Home screen
| Group | List? | Controls |
|-------|-------|----------|
| `home-hero-slides` | ✅ ordered list | N hero slides (image per slide; first slide also carries headline/subtitle/CTA/link). Add/remove/reorder slides |
| `home-social-proof` | single | "Loved by…" text, rating score, reviews text — fixes the fake-numbers launch blocker |
| `home-category-cards` | ✅ ordered list | **Which categories appear in "Shop by Category" and in what order**; each card: image override + title + link. Controls both desktop marquee and mobile compact carousel |
| `home-why-vairis` | single | Section image + heading + copy |
| `home-videos` | ✅ ordered list | Founder video cards: thumb, title, description, video link. Add a 4th, drop to 2 — admin's call |
| `home-testimonials` | ✅ ordered list | Review cards: quote, name, city, avatar image. Count & order = admin |
| `home-how-it-works` | ✅ ordered list | Step cards (icon stays built-in; title + description editable) |

### Catalogue / selection screens (PLP)
| Group | List? | Controls |
|-------|-------|----------|
| `plp-hero-<category>` | ✅ ordered list | Category hero **carousel**: N images, ordered (v1 had one override image; v2 controls the whole rotation) — one group per category incl. future ones |
| `plp-story-<category>` | ✅ ordered list | Rotating hero story lines (currently random from code) |
| `plp-bottom-trust` | ✅ ordered list | Trust cards under the grid (icon key + title + description) |
| `plp-help-links` | ✅ ordered list | "Need help choosing?" panel links (WhatsApp / video call / size guide) |

### Product page (PDP)
| Group | List? | Controls |
|-------|-------|----------|
| `pdp-trust-items` | ✅ ordered list | Guarantee labels under Add to Cart |
| `pdp-help-panel` | reuses `plp-*` groups | Same trust/help panel component |

### Purchase flow
| Group | List? | Controls |
|-------|-------|----------|
| `cart-founders` | single | Founders banner on cart (image + quote + subtext) |
| `checkout-shipping-note` | single | "Insured Delivery…" shipping card copy |
| `confirmation-what-next` | ✅ ordered list | "What happens next" step cards |

### Info pages
| Group | List? | Controls |
|-------|-------|----------|
| `contact-hero` | single | Contact page hero image + heading |
| `returns-hero`, `returns-sealed`, `returns-footer` | single each | Returns page imagery |

~20 groups. Anything not listed (auth pages, admin) is deliberately not marketing surface.

## 3. Admin UI (`/admin/content` v2)

- Sidebar/sections grouped by page (Global / Home / Category pages / Purchase / Info)
- Per group: item table showing thumb, title, active toggle, **↑/↓ reorder buttons**
  (persist by swapping `sortOrder`; drag-and-drop is a nice-to-have, not required),
  **+ Add item** (hidden at `maxItems`), delete with confirm
- Item editor: only the fields declared in the registry; image upload via existing
  `/api/admin/upload`; per-item active toggle
- Group header shows "using built-in defaults" vs "N custom items live"
- "Reset group" = delete all rows → instant fallback to built-ins

APIs:
- `GET /api/admin/content/[group]` → all rows incl. inactive, ordered
- `PUT /api/admin/content/[group]` → replace-whole-group write `{ items: [...] }` in a
  transaction (simplest correct ordering semantics; no per-item PATCH races)
- Public `GET /api/content/[group]` → active + ordered only, 60s edge cache

## 3b. Preview & publish workflow

Edits are **never live immediately**. Draft → preview on the real site → publish.

**Model:** add `draft Boolean @default(false)` to `SiteBanner`. Admin saves always write
DRAFT rows (copy-on-write per group). The live site reads `draft: false` only.

**Preview = the actual storefront, not a mock.** Uses Next.js Draft Mode:
- `GET /api/admin/content/preview/enable?next=/` — `requireAdmin`, sets the draft-mode
  cookie, redirects to the target page (`next` defaults to the page the edited group
  appears on — the registry records a `previewPath` per group)
- With the cookie set, `getBannerGroup()` and `/api/content/[group]` prefer draft rows
  where they exist, else live rows — so the admin browses the whole site exactly as it
  will look after publish, while normal visitors keep seeing live content
- Persistent "PREVIEW — viewing unpublished content" ribbon on the storefront while the
  cookie is active, with Exit (disable endpoint) + Publish shortcuts

**Admin UI per group:**
- Status chip: `live` / `draft pending` / `defaults`
- **Inline mini-preview** in the editor: rendered thumbnail strip of the group's items in
  their current order (image + title), updates as you edit/reorder — the cheap instant check
- **Preview on site** button → draft-mode redirect to `previewPath` — the real check
- **Publish** = transaction: delete group's live rows, flip drafts to live (+ revalidate)
- **Discard draft** = delete draft rows, keep live untouched

## 4. Renderer wiring (fallback-first, one pattern)

Each surface: `const items = await getBannerGroup("x"); const list = items.length ? items : BUILT_INS;`
Client surfaces (promo bar, contact page, cart founders) use the hook + render built-ins until
fetch resolves. Server surfaces (home, PLP, returns) read directly. Components stay dumb —
they render whatever list they're given, so count/order control is automatic.

## 5. Phases

1. **P1 — Model + read path**: migration (slot→group+sortOrder+draft), `getBannerGroup`
   (draft-aware), group registry with field metadata + previewPath, public API returns
   lists. v1 rows keep working.
2. **P2 — Admin v2 + preview/publish**: grouped UI, add/remove/reorder/active,
   replace-group PUT (drafts), inline mini-preview, Draft Mode preview-on-site with
   ribbon, Publish/Discard.
3. **P3 — Home**: hero slides, social proof, category cards (count+order), why-vairis,
   videos, testimonials, how-it-works.
4. **P4 — Global + PLP**: promo bar list, trust bar, PLP hero carousels, stories, trust
   cards, help links, PDP trust items.
5. **P5 — Purchase + info pages**: cart founders, checkout note, confirmation steps,
   contact/returns imagery.
6. **P6 — Verify**: seed custom groups → screenshot every surface (order respected, counts
   respected); delete groups → built-ins return; lint/tsc/build/flow regression.

Acceptance (the "total control" bar): from `/admin/content` alone — reorder home hero
slides, cut founder videos from 3 to 2, add a 6th promo message, hide a category card,
change every image on the site — **previewing each change on the real storefront before
customers see it** — with zero deploys, and deleting everything restores the original
design. Publish is atomic per group; visitors never see a half-edited state.

## 6. Out of scope (this plan)

- Scheduling (publish windows) and A/B variants — add `startsAt/endsAt` columns later if needed
- Per-locale content
- Rich text/markdown in banner copy (plain strings only)
