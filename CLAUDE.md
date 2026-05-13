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
- Auth: email/password + Google OAuth; admin gated via `ADMIN_EMAILS` env var
- Shop page (SSR, category filter), PDP (SSR, revalidate=60), Wishlist, Account page
- Cart API (GET/POST/PATCH/DELETE, force-dynamic), Admin product CRUD
- 23 products in prod with images + videos
- `lib/pricing.ts`: GST-correct pricing formula (see below)
- Loading skeletons for shop, PDP, wishlist, account

### Not built yet (priority order)
1. **P1** Custom domain → Vercel
2. **P2** Live gold rate fetch → GitHub Actions cron (not Vercel)
3. **P3** Razorpay checkout + webhook (BIS cert pending — Anil)
4. **P4** Shiprocket integration (post-Razorpay)
5. **P5** Cart page + checkout flow (blocked on Razorpay)
6. **P6** Admin: orders UI + Razorpay payment links
7. **P7** SEO: sitemap.xml, robots.txt
8. **P8** Email template redesign
9. **P9** Azure migration (Vercel sufficient now)
10. **P10** WhatsApp bot (Python service, future phase)

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

## 4. Pricing Formula (`lib/pricing.ts`)

```
goldValue   = weight × goldRatePerGram
making      = weight × makingChargePerGram + flatMakingCharge
GST         = goldValue × 3% + making × 5%
total       = goldValue + making + stoneCharges + miscCharges + GST
```

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
