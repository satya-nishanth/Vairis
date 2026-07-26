# Vairis — Claude Instructions

## 1. Graph-First: MANDATORY

This project has a knowledge graph. **DO NOT use Grep/Glob/Read to explore code** until you have queried the graph first.

| Task | Use |
|------|-----|
| Find a function/class | `semantic_search_nodes` |
| Trace callers/imports | `query_graph` (callers_of / callees_of / imports_of) |
| Code review | `detect_changes` + `get_review_context` |
| Blast radius of a change | `get_impact_radius` |
| Impacted execution paths | `get_affected_flows` |
| Architecture questions | `get_architecture_overview` + `list_communities` |
| Find dead code / plan rename | `refactor_tool` |

Fall back to Grep/Read **only** when the graph returns nothing useful.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

Graph auto-updates on file changes via hooks.

---

## 2. Project: Vairis Fine Jewellery

Next.js 14 App Router + Supabase (PostgreSQL + Auth + Storage) + Prisma 5 + Tailwind + Vercel (Hobby → Azure).

**Live:** https://vairis-ten.vercel.app (master branch auto-deploy)
**Supabase:** ohnydotpayefvaurtiyy.supabase.co
**Email:** Resend (working, template bare-bones)

### What's built
Full store — see `docs/FEATURES.md` for the complete inventory. Highlights:
- Auth (email/password + Google OAuth), address book, admin gated via `ADMIN_EMAILS`
- Catalogue: shop/category pages, collections, PDP with multi-diamond pricing
  (with/without exchange), reviews, live search
- Checkout: cart, promo codes, mock or Razorpay payment gateway
  (`PAYMENT_GATEWAY=mock` — full lifecycle without keys, see `lib/payments/mock.ts`)
- Shipping: manual, Shiprocket, DTDC adapters (`SHIPPING_MOCK=true` for keyless dev)
- Order lifecycle v2: split deliveries, returns, RTO, refund ledger, cancellation
- Admin: product CRUD (draft/AI-draft/live), pricing settings, collections,
  home-sections CMS, promos, reviews moderation, contacts inbox, analytics,
  dashboard stats
- SEO (sitemap/robots/JSON-LD), legal pages, branded emails, rate limiting,
  Sentry (opt-in), first-party analytics + optional GA4

### Remaining before real-money launch
1. **P1** Custom domain → Vercel
2. **P2** Turn on gold-rate + order-sweep GitHub Actions crons (workflows committed, need repo secrets)
3. **P3** Razorpay LIVE keys + webhook (BIS cert pending — Anil) — swap `PAYMENT_GATEWAY=mock` → `razorpay`
4. **P4** Shiprocket/DTDC real API keys — swap `SHIPPING_MOCK=true` off
5. **P5** Resend domain verification
6. **P6** e2e test suite (Stage 7, in progress)
7. **P7** Azure migration (Vercel sufficient now)
8. **P8** WhatsApp bot (Python service, future phase)

---

## 3. Tech Constraints — DO NOT VIOLATE

**Supabase DB connection**
- Use Session Pooler: `aws-1-ap-south-1.pooler.supabase.com:5432`
- NOT port 6543 (Transaction Pooler) — breaks Prisma prepared statements
- No direct IPv6 on free tier

**Vercel**
- Build command: `prisma generate && next build` (required — Vercel caches node_modules)
- All API routes MUST have `export const dynamic = 'force-dynamic'`
- No Vercel crons (Hobby plan) — use **GitHub Actions** scheduled workflows
- `NEXT_PUBLIC_*` env vars need "Add to all environments" set explicitly in Vercel UI

**Cron jobs → GitHub Actions only.** Never suggest Vercel crons.

**Infra default → Azure** (startup credits). Vercel stays until Azure migration.

---

## 4. Pricing Formula v2 (`lib/pricing.ts`)

```
goldValue  = weight(size) × goldRatePerGram
goldVA     = goldValue × vaGoldPct        (PricingSettings, default 5%)
making     = weight × makingChargePerGram + flatMakingCharge
stoneValue = Σ stones(carat × DiamondRate[type][withExchange?]) + legacy flat stoneCharges
stoneVA    = stoneValue × vaStonePct      (PricingSettings, default 5%)
GST        = (goldValue + goldVA + stoneValue + stoneVA) × 3% + making × 5%
total      = goldValue + goldVA + making + stoneValue + stoneVA + miscCharges + GST
```

VA = "Value Addition" — a **disclosed** breakup line (admin-editable label + %),
shown on PDP/checkout/order/email. Weights and carats shown to the customer
are always the true values — **never** silently inflated. The 105%/5%
refundable-deposit model is retired (`depositAmount` stays 0 on new orders).

Diamond rates (`DiamondRate` table) are per-carat, two rates each
(with/without exchange) — admin-editable at `/admin/settings/pricing`.
Product diamonds live in `ProductStone` (type + carat, count/label optional).

Do not change this formula without explicit instruction.

---

## 5. Product / Catalogue Rules

- **No Silver 925** — not part of Vairis offering. Remove from any enum/dropdown/label.
- **Image order**: Front → Left → Right → Back. Enforce in upload UI and MediaGallery. Index 0 = front, always shown first.
- **Gold color** (future): Split `metalPurity` (18K/22K) and `metalColor` (yellow/white/rose) on `ProductVariant`. Not urgent — design when checkout is close.

---

## 6. Working Style

- Terse. Fragments OK. No filler, no pleasantries.
- Don't over-engineer. Lean solutions. No premature abstractions.
- Don't rotate secrets unless explicitly asked.
- Don't add backwards-compat shims, rename `_vars`, or re-export removed types.
- Stack preference: Next.js-only until WhatsApp/AI phase needs Python.
- Team: Nishi (sole engineer), Anil (founder/biz), Vasu (co-founder/advisor), Anitha (ops/design).
