# Phase 7 — Final Cutover Verification & Decommission

**Goal:** confirm prod is the real, stable, sole home for Vairis, then retire Vercel and Supabase. `staging` doesn't get decommissioned — it's the permanent pre-prod environment for every future change from here on.
**Ships app code:** Yes, via the existing CI/CD (no new deploy mechanism — this phase is verification and cleanup).
**Est. effort:** ongoing over a 2+ week monitoring window, plus a half-day of actual decommission work at the end.

By this point: database (Phase 2), auth/storage (Phase 3), and compute (Phase 4) are all on Azure in both environments; prod DNS points at Azure (Phase 5); secrets, alerting, and DR are hardened in prod (Phase 6). This phase is about *confidence*, not new infrastructure.

## 1. Pre-decommission checklist

Don't touch Vercel or Supabase until every box here is checked, ideally for at least two full weeks post-DNS-cutover:

- [ ] Full LAUNCH.md §5 QA gate green against the production Azure URL
- [ ] Zero unexplained 5xx spikes in `appi-vairis-prod` over the monitoring window
- [ ] At least one real payment (test-mode or, if live by now, a real low-value order) has gone through the full lifecycle end-to-end: checkout → Razorpay → webhook → confirmation email → admin ship → deliver → deposit refund → refund lands correctly, per LAUNCH.md §5's manual test
- [ ] Gold-rate sync and order-expiry sweep crons have run successfully multiple times against the new domain
- [ ] Admin team (Anil/Vasu/Anitha per CLAUDE.md's team list) has used the live site/admin without reporting issues
- [ ] Cost Management numbers are in line with Phase 6's estimate — no runaway spend surprise
- [ ] The Postgres restore drill from Phase 6 has actually been performed against prod's backup, not just planned

## 2. Decommission sequence

Once the above is genuinely satisfied:

1. **Pause, don't delete, the Supabase project first.** Confirm nothing breaks (it shouldn't — Phases 2 and 3 already moved database, auth, and storage off it).
2. Wait a few more days watching for anything Supabase-pause broke.
3. **Pause/remove the Vercel project.** Confirm DNS has fully propagated (no more Vercel traffic in its dashboard) before this step.
4. After another confidence window, delete both the paused Supabase project and Vercel project outright.
5. Remove now-dead dependencies: `@vercel/analytics` (flagged in Phase 4 for later removal — this is later). Confirm no leftover Supabase-managed-service-specific code paths remain from Phase 3's storage rewrite.
6. Remove unused env vars still referenced anywhere (old Supabase URLs/keys, Vercel-specific config).

## 3. `staging` is not going anywhere

This is the payoff for having built everything twice: `staging` isn't migration scaffolding to tear down, it's now the permanent pre-prod environment. Every future change to Vairis's infrastructure — a new resource, a Bicep tweak, a Container App scaling change — goes through the same rhythm this whole roadmap used: `azd env select staging` → `azd provision`/`azd deploy` → verify → `azd env select prod` → repeat. The migration is finished; the workflow it established isn't a one-off.

## 4. Documentation cleanup

- Update **CLAUDE.md**:
  - §2 "Live" line — new production URL, new hosting note (Azure Container Apps + Front Door, not Vercel).
  - §3 "Tech Constraints" — replace the Supabase Session Pooler rule with the Azure Flexible Server PgBouncer session-mode equivalent (Phase 2); replace Vercel-specific build/env-var rules with Container Apps/azd equivalents; keep "Cron jobs → GitHub Actions only" (still true — now `azd deploy` triggered); update "Infra default → Azure" from aspirational to simply true; add a line documenting the `staging`/`prod` azd environment split for future work.
  - Add a line pointing at [02-azd-and-resources-primer.md](./02-azd-and-resources-primer.md) as the reference for "how do I deploy a change" — it now answers that question for the whole project's future, not just this migration.
- Update **LAUNCH.md**: replace Vercel-specific env var instructions with Container Apps/Key Vault equivalents; §6 "Launch-day sequence" should reference `azd env select prod && azd provision && azd deploy` instead of "merge → Vercel auto-deploy."
- Mark this `docs/azure-migration/` directory as historical once complete (a one-line "✅ completed \<date\>, staging/prod workflow is now standard practice" banner at the top of `00-overview.md`) rather than deleting it — it's a useful record of what was done and why.

## 5. Rollback plan, by cutover step (read this before you need it)

| If this breaks... | ...do this |
|---|---|
| Database (Phase 2), within the first week post-prod-cutover | Revert `DATABASE_URL`/`DIRECT_DATABASE_URL` to Supabase values, redeploy (Supabase kept warm) |
| Auth/Storage (Phase 3), within the first week | Revert `NEXT_PUBLIC_SUPABASE_URL`+keys / `AZURE_STORAGE_CONNECTION_STRING` to Supabase values, redeploy |
| DNS cutover (Phase 5), within 1-2 weeks | Revert the DNS record to Vercel's target (kept warm, ready to take traffic back) |
| Something breaks **after** decommission (step 4+ above) | No fast revert exists by design — recovery means restoring from Azure's own backups (Phase 6), not falling back to a deleted Supabase/Vercel project. This is exactly why the checklist in §1 exists. |

## 6. What's next after this roadmap

- The future **WhatsApp bot (P10)** from CLAUDE.md's priority list: build it directly on Azure (Container Apps or Azure Functions, both have solid Python support) as a new `azd` service in `azure.yaml`, going through `staging` before `prod` from day one — no migration burden, since it doesn't exist yet, and it inherits the workflow this roadmap established.
- Once real order volume exists, revisit the deferred items flagged throughout: Postgres General Purpose tier upgrade, zone-redundant HA, Reserved capacity pricing, per-PR ephemeral environments beyond the shared `staging`, Redis-backed shared ISR cache. None were skipped by oversight — each was deliberately deferred with a stated trigger condition ("once traffic justifies it"). Check those conditions periodically rather than guessing.

---

*Back to [00-overview.md](./00-overview.md) · Previous: [09-phase6-security-cost-dr.md](./09-phase6-security-cost-dr.md) · This is the last phase.*
