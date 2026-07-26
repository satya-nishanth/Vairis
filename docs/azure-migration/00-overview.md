# VAIRIS — Azure Migration Roadmap: Overview

**Audience:** Nishi (AWS-experienced, Azure newbie). This roadmap explains Azure concepts by analogy to AWS throughout. See [01-aws-to-azure-glossary.md](./01-aws-to-azure-glossary.md) for the AWS↔Azure vocabulary, and [02-azd-and-resources-primer.md](./02-azd-and-resources-primer.md) for what every resource actually does and how the deploy tooling works — read that one before Phase 0, everything after assumes it.

**Why this migration:** CLAUDE.md §3 already states the target: *"Infra default → Azure (startup credits). Vercel stays until Azure migration."* This is that migration, planned phase-by-phase so the store never goes down and each phase is independently reversible.

**Status quo it starts from:** everything in [LAUNCH.md](../LAUNCH.md) and [FEATURES.md](../FEATURES.md) — read those first if you haven't. Summary of current stack:

| Layer | Current | Hosted on |
|---|---|---|
| Frontend + API (Next.js 16 App Router, SSR + ISR + API routes) | Vercel Hobby | Vercel |
| Database (Postgres via Prisma 5, session pooler on :5432) | Supabase | Supabase |
| Auth (email/password + Google OAuth) | Supabase Auth (GoTrue) | Supabase |
| File storage (product images/video) | Supabase Storage | Supabase |
| Transactional email | Resend | Resend (third-party, stays put) |
| Payments | Razorpay | Razorpay (third-party, stays put) |
| Scheduled jobs (gold-rate sync, order-expiry sweep) | GitHub Actions → Bearer-secret POST to API routes | GitHub |
| Analytics | `@vercel/analytics` | Vercel |

Nothing here is exotic. This is a small, early-stage store (23 products, pre-launch payments, WhatsApp-enquiry mode is the live flow today per CLAUDE.md). That smallness is a gift — it means the safe, boring migration path (build it in staging, prove it, then repeat in prod) is cheap enough to actually do properly.

---

## The core pattern: everything is built twice, on purpose

This roadmap uses **Azure Developer CLI (azd)** with two environments, `staging` and `prod` — two fully isolated copies of the same infrastructure, driven from one shared set of Bicep templates (see the primer for why azd, not hand-run CLI commands, is what makes this safe). Every phase from Phase 0 onward follows the same rhythm:

```
1. Write/extend this phase's Bicep module.
2. azd env select staging  →  azd provision  →  (azd deploy, if the phase ships app code)
3. Verify it in staging — break things safely, iterate on the Bicep until it's right.
4. azd env select prod    →  azd provision  →  (azd deploy)
5. Verify it in prod.
```

Staging isn't a toy — it's a real, complete, running copy of the stack (own database, own Container Apps, own domain-ish endpoint) at a cheaper tier. By the time anything touches prod, the exact same template has already run successfully once. This is a stronger guarantee than the "dry run then hope" pattern of hand-copying CLI commands between environments — because it's *literally the same template*, staging and prod cannot silently diverge.

## Guiding principles

1. **Nothing reaches prod until it's proven in staging.** Not "tested," proven — deployed via the identical Bicep, exercised, verified. This is now mechanical (`azd env select`), not a discipline you have to remember to apply.
2. **Minimize application code churn, especially early.** The biggest risk in any migration isn't infra, it's the app breaking. Where an Azure-native replacement would force a rewrite (e.g. swapping Supabase Auth for Entra External ID), this plan defers that unless there's a real reason, and picks the option that keeps app code closest to what it already does. See Phase 3 for the concrete tradeoff.
3. **GitHub Actions stays the CI/CD and cron backbone.** CLAUDE.md is explicit that crons must be GitHub Actions, never platform crons. `azd pipeline config` (Phase 0) wires GitHub Actions to deploy via azd itself, so this isn't a second system alongside azd — it's azd, triggered by GitHub instead of your terminal.
4. **Cost-conscious, not cost-paranoid.** Startup credits cover this, but size everything at the smallest tier that works — and staging, being a second full copy of the stack, is where this matters most: staging tiers are deliberately cheaper/smaller than prod's throughout this roadmap, called out per-resource.
5. **Reversible until the last phase.** Vercel and Supabase are not deleted, paused, or touched destructively until Phase 7 (final decommission) — every phase before that is additive or dual-running, and prod on Azure only starts taking real traffic in Phase 5.

## Target architecture (prod environment; staging is the same shape, smaller tiers)

```
                         ┌─────────────────────────┐
                         │   Azure Front Door       │  (CDN + WAF + TLS + custom domain)
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │  Azure Container Apps      │  (Next.js standalone, autoscale)
                         │  (VNet-integrated)          │
                         └───┬──────────────┬─────────┘
                              │              │
              ┌───────────────▼──┐   ┌───────▼────────────┐
              │ Azure DB for       │   │ Self-hosted GoTrue  │  (auth, in same VNet)
              │ PostgreSQL         │◄──┤ (Container Apps)    │
              │ Flexible Server    │   └──────────────────────┘
              │ (private endpoint) │
              └────────────────────┘
                              ▲
              ┌───────────────┴──────────────┐
              │ Azure Blob Storage             │  (product images/video)
              └─────────────────────────────────┘

   Key Vault (secrets) · Azure Monitor + App Insights (observability)
   ACR (shared across staging/prod) · GitHub Actions via `azd pipeline config`
   Razorpay + Resend (unchanged, third-party, no infra dependency)
```

## Phase map

| Phase | Name | Ships app code? | File |
|---|---|---|---|
| 0 | Foundations — azd project, both environments, shared ACR, budget | No | [03](./03-phase0-foundations.md) |
| 1 | Observability + storage dry-run, in staging first | No | [04](./04-phase1-observability-storage-dryrun.md) |
| 2 | Database — Postgres module, staging rehearsal then prod cutover | No | [05](./05-phase2-database.md) |
| 3 | Auth + Storage — GoTrue + Blob, staging then prod | No | [06](./06-phase3-auth-storage.md) |
| 4 | Compute — Next.js Container App, staging then prod (still parallel to Vercel) | Yes | [07](./07-phase4-compute.md) |
| 5 | Network, DNS cutover, `azd pipeline config` CI/CD | Yes (via CI) | [08](./08-phase5-network-cicd.md) |
| 6 | Security, observability, cost, DR hardening | No | [09](./09-phase6-security-cost-dr.md) |
| 7 | Final cutover verification + decommission | Yes (via CI) | [10](./10-phase7-cutover-decommission.md) |

Do them in order. Every phase's Bicep additions get proven in `staging` before ever touching `prod` — that's not a separate step listed per phase, it's the default rhythm described above, baked into how each phase's instructions are written.

## What does NOT move

- **Razorpay** — external gateway, no infra dependency either way.
- **Resend** — external email API, works identically from any host.
- **GitHub** — source control and CI/CD stay on GitHub Actions throughout, now via `azd pipeline config` instead of hand-written OIDC + workflow YAML.
- **The pricing formula, order lifecycle, refund ledger, etc.** — this is an infra migration. Zero application business logic changes.

## Open decisions you'll need to make

1. **Container Apps vs App Service for compute** (Phase 4). Recommendation: Container Apps. `sharp` (native image-processing dependency) and Next.js standalone output both run more predictably in a container you fully control than on App Service's more opinionated runtime.
2. **Self-host Supabase's GoTrue vs migrate to Entra External ID** (Phase 3). Recommendation: self-host GoTrue. Full reasoning in that phase's file — short version: it keeps every auth call site in the app unchanged, which is the whole point of "smooth transition."
3. **Staging tier sizing** — each phase calls out a specific cheap tier for staging (e.g. Postgres Burstable B1ms in both environments is already the cheapest tier, so staging and prod are identical there; Container Apps staging runs with `min-replicas 0` where prod runs `1`, etc.). These are defaults, not mandates — adjust per resource if staging needs to be closer to prod for a specific rehearsal.

## A note on the future WhatsApp bot (P10)

CLAUDE.md lists a future Python WhatsApp bot service (P10) as not-yet-built. Nothing in this roadmap needs to account for it — when that work starts, build it directly on Azure Container Apps or Azure Functions (both have solid, first-class Python support) as a new `azd` service in the same `azure.yaml`, rather than standing it up on some third infra provider. It's a greenfield build, not a migration, so it isn't a phase here — just a placement note for whoever plans it.

---

*Next: [01-aws-to-azure-glossary.md](./01-aws-to-azure-glossary.md), then [02-azd-and-resources-primer.md](./02-azd-and-resources-primer.md) — read both before Phase 0.*
