# Staging Execution Log — What Actually Happened (Phases 0-3)

**Audience:** you, treated as completely new to Azure. This document exists because the *plan* documents (03 through 06) describe the ideal path — but real execution against real Azure hit a string of genuine bugs and undocumented requirements that the plan couldn't have known about. This is the "what really happened, and why" companion. Read it after (or alongside) the phase docs it corresponds to.

**Scope so far:** `staging` environment only. `prod` has not been touched — per your explicit instruction, everything in this log applies only to the `staging` copy of the infrastructure.

---

## 1. What's live right now

| Resource | Name | Purpose |
|---|---|---|
| Resource group | `rg-vairis-staging` | Container for everything below |
| Shared registry | `vairisacr` (in `rg-vairis-shared`) | Holds Docker images, shared between staging/prod |
| Key Vault | `kv-vairis-staging` | Secrets storage (not wired to anything yet — Phase 6 job) |
| Log Analytics + App Insights | `log-vairis-staging` / `appi-vairis-staging` | Where logs and telemetry land |
| Blob Storage | `vairisstagingmedia` | Product images/videos — mirrored copy of Supabase Storage |
| Virtual Network | `vnet-vairis-staging` | Private network — Postgres and Container Apps live inside it |
| Container Apps Environment | `cae-vairis-staging` | The "cluster" that hosts containers |
| Postgres | `psql-vairis-staging` | Database — VNet-only, not reachable from the public internet |
| GoTrue (auth) | `gotrue-vairis-staging` | Self-hosted replacement for Supabase Auth — **now live and healthy** |

**Not yet built:** the actual Next.js app in staging (Phase 4), Blob storage code cutover (Phase 3 Part C), networking/CI-CD hardening (Phase 5).

---

## 2. A concept you need before any of this makes sense: Azure resource updates aren't always in-place

Coming from AWS, you're used to `terraform apply` or a console edit just... changing the thing. Azure (via Bicep/ARM) mostly works the same way — **except for a specific, important category of properties that are locked at creation time.** Several of the failures below come from hitting one of these locked properties. The lesson up front: **if a fix doesn't seem to take effect, check whether you just tried to change something immutable** — the fix might have "succeeded" (Bicep said `SUCCESS`) while silently leaving the old value in place, or it might have failed with a specific "conflicting state" error.

---

## 3. Phase 0 — Foundations

### 3.1 Wrong Azure account entirely

**What happened:** `azd provision` failed with a tenant/subscription mismatch. It turned out the CLI tools (`az`, `azd`) were logged into the **bot's** Azure account/subscription from the earlier WhatsApp bot deployment — a completely different Azure subscription than the one you'd since set up for the website.

**Why this matters for you as a beginner:** Azure has *three* separate identity concepts stacked on top of each other:
- **Microsoft account** (e.g. `contact@thevairis.com`) — who you are
- **Tenant** (aka "directory") — the organizational container your account lives in. Confusingly, a personal Azure signup auto-creates a tenant literally named "Default Directory."
- **Subscription** — the actual billing/resource container, sits inside a tenant.

Two different subscriptions can both be named "Azure subscription 1" (Azure's default name) while being totally separate billing entities in separate tenants — which is exactly what happened here and caused real confusion (`az account list` showed two identically-named subscriptions).

**Fix:** you ran `az login` and `azd auth login` fresh yourself (interactively, since it needs a browser), landing on the correct subscription (`8e5d9bef-...`), then we re-pointed the `azd` staging environment at it via `azd env set AZURE_SUBSCRIPTION_ID`.

**Lesson:** before touching any Azure CLI command in a new project, always run `az account show` and confirm the subscription ID matches what you expect — especially if you've ever worked on more than one Azure project from the same machine.

### 3.2 `azd`'s own known bug — config file corruption

Not hit this time (we upgraded `azd` from 1.28.0 → 1.28.1 first, which happened to fix it), but worth knowing: version 1.28.0 had a real bug where `azd provision` could corrupt its own local config file (`.azure/staging/.env`) with mismatched quotes. If you ever see `azd` failing to parse its own environment file, check the installed version and upgrade first (`brew uninstall azd && brew install --cask azure/azd/azd`).

### 3.3 Container Registry — subscription not registered for the resource type

**Error:** `MissingSubscriptionRegistration: The subscription is not registered to use namespace 'Microsoft.ContainerRegistry'`

**Why:** every "resource provider" (the thing that knows how to create a specific *type* of resource — container registries, databases, container apps, etc.) has to be explicitly "registered" on a subscription before you can create that type of resource in it. **Brand-new subscriptions start with almost nothing registered.** This isn't a permissions problem — it's a one-time activation step.

**Fix:** `az provider register --namespace Microsoft.ContainerRegistry --wait`. You'll likely hit this same error for other resource types on a fresh subscription (Postgres, Container Apps, etc.) — the fix is always the same pattern, just with a different `--namespace`.

---

## 4. Phase 1 — Observability + Storage

This phase went smoothly except for one thing worth flagging:

### 4.1 `.env.local` vs `.env.prod` — pointed at the wrong database

The very first attempt to mirror Supabase Storage into Azure Blob reported **0 objects found** — technically correct, but not what we wanted. `.env.local` (your everyday dev file) points at a **local, empty Supabase instance** running on your laptop (`127.0.0.1:54321`), not the real production Supabase project. The real data (1390 product images) only showed up once we pointed the script at `.env.prod`'s credentials instead.

**Lesson:** always double check *which* environment's credentials a script is actually using before concluding "there's no data" — it's very easy to be looking at the wrong database entirely, especially when local dev intentionally mimics the same variable names as production.

---

## 5. Phase 2 — Database

### 5.1 PgBouncer isn't supported on the cheap tier — at all

**Error:** `ServerParameterToCMSPgBouncerNotSupportedForBurstable: Server ... is using the 'Burstable' compute tier, and PgBouncer isn't supported on servers which are using this compute tier.`

The original plan (written before any of this was tested against real Azure) assumed Azure's built-in PgBouncer (connection pooler) would work on the cheapest ("Burstable") Postgres tier, matching how Supabase's own pooler works. **It doesn't — Burstable tier doesn't support PgBouncer at all**, not even in a disabled/default state. This isn't a config mistake; it's a hard platform limitation discovered only by actually trying to deploy it.

**Fix:** dropped the PgBouncer configuration from the staging database entirely. Prisma connects directly to Postgres instead. This is actually fine correctness-wise (direct connections don't have the "transaction-mode pooler breaks prepared statements" problem that made Supabase's Session Pooler mandatory in the first place) — it just means fewer total concurrent connections are available (capped by the tier's `max_connections`). Something to revisit only if staging starts hitting connection-count errors under real load.

### 5.2 Stale database password

Not a platform bug — just a real trap worth naming: the password saved in your local `.env.prod` file was out of date (predated some connection-string work done earlier in this project). Both the Transaction Pooler (6543) and Session Pooler (5432) rejected it with "password authentication failed," even though the *format* of everything else was correct. You updated the file with the current password and everything connected immediately.

**Lesson:** "authentication failed" with an otherwise-correct-looking connection string almost always means exactly what it says — the credential itself is wrong or stale, not some subtler config issue. Check that first before chasing anything more exotic.

### 5.3 Direct database host needs IPv6 — doesn't work from an ordinary home/office network

Supabase gives you two ways to connect: a "direct" host (`db.<project>.supabase.co:5432`) and a "pooler" host (`aws-1-<region>.pooler.supabase.com`, on ports 5432 or 6543). The direct host **only resolves over IPv6** on Supabase's free tier, and most home/office networks (and this machine) don't have working outbound IPv6. Trying to `pg_dump` from the direct host failed with a DNS resolution error, not a connection error — a subtle but important difference (DNS failing means "this address doesn't even exist to me," not "I can't reach it").

**Fix:** used the Session Pooler host on port 5432 instead, which resolves fine over ordinary IPv4.

---

## 6. Phase 3, Part A — Network + locking down the database

### 6.1 Postgres VNet integration needs its own private DNS zone — and the exact name matters

**Error:** `EmptyPrivateDnsZoneArmResourceId: The provided Private DNS zone ARM resource ID should not be empty for servers with Virtual Network access.`

Putting Postgres inside a private network (so it's no longer reachable from the public internet) isn't just "attach it to a subnet" — Azure also requires a **Private DNS Zone**, a separate resource that lets things *inside* the VNet resolve the database's hostname to its private IP address. The original plan's Bicep template didn't include this at all.

Once we added a DNS zone, we hit a second, much more confusing error:

**Error:** `PrivateDnsZoneHasWrongZoneSuffix: The Private DNS Zone name provided is not valid. It has to end with psql-vairis-staging.`

This error message is genuinely misleading if you read it literally. It does **not** mean the zone name should end with your server's name. After checking Microsoft's own documentation and community reports, the zone must be named **exactly** `private.postgres.database.azure.com` — no server-name prefix, no `privatelink.` prefix (that convention is for a *different* Azure networking feature, Private Endpoints, easy to confuse with this one). The server's hostname becomes a DNS *record* inside that zone, not part of the zone's own name.

**Lesson:** when an Azure error message references your own resource name in a confusing way, don't trust the literal wording — search for the exact error code (`PrivateDnsZoneHasWrongZoneSuffix`) instead of trying to reverse-engineer what the sentence means.

### 6.2 The database subnet needs its own delegation too

**Error:** `OperationFailed: The subnet name as snet-database is missing required delegations Microsoft.DBforPostgreSQL/flexibleServers`

A "subnet delegation" tells Azure "this specific slice of the network is reserved for use by this specific Azure service." The plan's network template delegated the Container Apps subnet correctly but forgot to delegate the *database* subnet to Postgres. Every subnet that will directly host a specific managed Azure service (not just any VM) typically needs this.

### 6.3 The big one: you cannot switch a database from public to private after creating it

**Error:** (after fixing 6.1 and 6.2, provisioning still failed with the same DNS zone suffix error, on a database that already existed)

This one took real investigation to understand, because the error text was identical to problem 6.1 even though that problem was already fixed. The actual cause: **Azure Postgres Flexible Server's networking mode (public internet vs. private VNet-only) is decided once, at creation time, and cannot be changed afterward.** Our staging database had originally been created in Phase 2 as *public* (before any VNet existed). Trying to "update" it in place to *private* isn't a supported operation — Azure's error handling for this specific invalid transition is, unfortunately, the same generic "wrong DNS zone" message as an actually-wrong DNS zone, which is why it looked like the same bug recurring.

**Fix:** deleted the staging database entirely and let it get recreated fresh, this time with the VNet configuration present from the very first creation. Since staging holds a *copy* of real data (never the only copy — the real source is Supabase, untouched throughout all of this), deleting and recreating it was safe and just meant re-running the data-restore step. This would be a much bigger deal in `prod`, and one more reason the plan's staging-first approach exists — better to discover "you can't change this later" against a disposable copy than against the real database.

**Lesson:** if changing a "simple" setting on an existing Azure resource keeps failing with an error that doesn't quite make sense, consider whether that property might simply be immutable — Azure's error messages don't always say "you can't change this," they sometimes just fail in a way that looks like something else is wrong.

---

## 7. Phase 3, Part B — Self-hosted GoTrue (the hardest part, by far)

This is the part the original plan explicitly warned about ("auth is the harder half... 3-5 days"). It took six distinct, genuine bugs — not six guesses, six *confirmed* separate problems — to get a working self-hosted auth server. Documenting all of them because each one teaches something different about how these systems actually work under the hood.

### 7.1 The database password needs URL-encoding when embedded in a connection string

**Symptom:** the GoTrue container crash-looped immediately on boot with a Go-language crash (`panic: runtime error: invalid memory address or nil pointer dereference`, inside `net/url.(*URL).Query()`).

**What this actually means:** GoTrue's `DATABASE_URL` is a single string like `postgres://user:password@host:5432/db`. Our database password was randomly generated and happened to contain characters like `/` and `+` (normal for a base64-encoded random string) — but those characters have *special meaning* inside a URL (`/` normally separates path segments). When Go's URL parser hit an unescaped `/` in the middle of the password, parsing failed outright, and the specific code path that used the (failed) result didn't check for that failure before using it — hence the crash instead of a cleaner error message.

**Fix:** used Bicep's `uriComponent()` function to percent-encode the password before building the connection string (turning `/` into `%2F`, etc.) — the standard fix for "a piece of freeform text needs to become safely part of a URL."

**Lesson:** any time you build a URL by gluing strings together yourself, ask whether any of the pieces (especially passwords) could contain characters that are special to URLs. This exact bug class — "works with simple test passwords, breaks with real random ones" — is extremely common and easy to miss until you hit it for real.

### 7.2 A required setting was simply missing from the original plan

**Error:** `Failed to load configuration: required key API_EXTERNAL_URL missing value`

GoTrue needs to know its *own* public URL (separate from `GOTRUE_SITE_URL`, which is the URL of the *app* it serves, i.e. the Vairis website) — it uses this to construct callback URLs for things like OAuth. The original migration plan's Bicep template simply didn't include this required setting.

**Fix:** since Azure Container Apps assigns a predictable hostname pattern (`<app-name>.<environment-domain>`), we could compute this URL from values Bicep already knew, without needing a circular self-reference (a resource can't normally read its own generated properties while it's still being defined).

### 7.3 The image tag `:latest` doesn't exist for this image

**Error:** `MANIFEST_UNKNOWN: manifest unknown; unknown tag=latest`

Supabase's GoTrue Docker image was never published with a `:latest` tag at all — only specific version numbers (like `v2.172.0`). This is actually a *good* practice on Supabase's part (it forces you to consciously choose a version rather than silently getting whatever's newest, which could break things unexpectedly) — but it means you can't just assume `:latest` works the way it does for most Docker images.

### 7.4 Container Apps revisions don't always update just because you re-deployed

This isn't an error message — it's a subtler trap. Azure Container Apps has a concept of "revisions" (numbered snapshots of a container's configuration). When you change a *secret's value* (as opposed to adding/removing an environment variable, or changing the image), Azure does **not** automatically create a new revision or restart the running container to pick up the new value — the old, already-running container instance keeps using whatever secret value it started with. Two fixes were applied on top of this discovery, run in the same troubleshooting arc:

1. `az containerapp revision restart` — manually forces the currently-running revision to restart, which does re-read secret values fresh.
2. Explicitly set `activeRevisionsMode: 'Single'` in the Bicep template — without this, Container Apps can leave *multiple* old revisions simultaneously "active" and serving traffic, which is confusing to debug (you might be looking at logs from an old, already-fixed revision while a stale one is still actually handling requests).

**Lesson:** after fixing a secret's *value* in Azure Container Apps, always explicitly restart the revision — don't assume a successful `provision`/deploy alone means the running container saw the change.

### 7.5 The real depth of the problem: GoTrue's own migration bookkeeping, three layers deep

This was the hardest part to diagnose, and it's worth walking through slowly because the *symptoms* kept changing even though we hadn't actually fixed the underlying issue — a classic "the error message changed, so it looks like progress, but it's actually two unrelated bugs stacked on top of each other" situation.

**Background — what GoTrue does on startup:** like many serious applications, GoTrue owns its own database schema, and manages changes to that schema over time via *migrations* — small, timestamped SQL scripts, each one a single incremental change, applied in order. GoTrue keeps a ledger (a database table) recording exactly which migrations have already run, so that restarting the app doesn't try to re-run (and fail on) changes that already happened.

**Bug layer 1 — one specific historical migration is broken on modern Postgres.**
One of GoTrue's own bundled migrations (dated December 2022, doing a one-time data cleanup) does a SQL comparison between a `uuid` column and a `text` column without an explicit type cast. Modern Postgres (16, what we're running) refuses this outright: `ERROR: operator does not exist: uuid = text`. Older Postgres versions were apparently more lenient about this. This is a genuine bug in that specific migration file, still present in the GoTrue version we're using (`v2.172.0`) — not something we did wrong.

**Bug layer 2 — my first fix targeted the wrong database schema entirely.**
The natural fix for "a specific migration is broken" is: manually tell the ledger "this one's already done, skip it." I did this — but I inserted that ledger entry into `auth.schema_migrations` (the `auth` schema, where Supabase's own hosted product keeps this table). **GoTrue's actual database connection doesn't set a specific "search path,"** so when it looks for its own ledger table, Postgres resolves the unqualified name against the *default* schema — `public`, not `auth`. My fix was invisible to GoTrue because it was quite literally looking in a different room. This took real, careful verification to catch: multiple attempts *looked* identical in the logs (same error, verbatim) even after the "fix," which is exactly the situation where it's worth stopping and directly querying the database yourself to check your assumptions, rather than trying yet another variation of the same guess.

**Bug layer 3 — GoTrue's bundled migrations don't include the beginning of its own history.**
Once the ledger was in the right schema, GoTrue got *past* the broken migration — progress — but immediately hit a new error: `relation "auth.users" does not exist`, while trying to run a migration that *modifies* that table. Investigating what had actually run revealed the real shape of the problem: GoTrue `v2.172.0`'s bundled migration files only go back to **2021**. The genuinely foundational migrations — the ones that `CREATE TABLE auth.users` in the first place — date from **2017-2020**, and simply aren't included in this version's Docker image at all. This makes sense once you know Supabase's *intended* self-hosting model: they expect you to start from their own `supabase/postgres` base Docker image, which already has that early-2020s baseline schema built in via its own startup scripts, completely separately from anything GoTrue itself manages. We were starting from a vanilla Azure Postgres server with no baseline at all, so GoTrue's "just apply the newer patches" assumption didn't hold.

**Final fix:** rather than trying to source Supabase's exact baseline SQL from their infrastructure repo, we used a source we already had available and knew was correct: your local development Supabase database (which every `supabase start` on your machine already bootstraps with a complete, current `auth` schema). We took a structure-only copy of that (no data, no real users — just table/function definitions) and restored it into staging's database, then seeded the ledger table with *all* the known migration version numbers (76 of them, going back to 2017) so GoTrue would see its entire migration history as already satisfied and skip straight to serving traffic.

### 7.6 The port GoTrue actually listens on isn't the port Supabase's own docs imply

**Symptom:** after every other fix, the container's own logs showed it starting up cleanly (`"GoTrue API started on: :8081"`) — but the public URL still returned a generic Azure "this app is stopped or does not exist" error.

The original plan's Bicep configured Azure's ingress (the piece that routes public internet traffic into the container) to forward to port **9999**. That number comes from Supabase's `docker-compose.yml`, where `9999` is the *external*, host-machine port that docker-compose happens to map to GoTrue — but the container's own internal listening port, regardless of how docker-compose exposes it externally, defaults to **8081**. Since nothing inside the container was listening on 9999, Azure's ingress had nowhere to route traffic to, and the resulting error message (a generic Container Apps "stopped or does not exist" page) gave no hint that this was a port mismatch specifically.

**Lesson:** when copying a "port number" from a docker-compose file into a different deployment platform, double check whether it's the container's actual internal listen port or just an external mapping chosen somewhat arbitrarily by that compose file's author — they are very often different numbers, and nothing forces them to match.

---

## 8. General lessons, gathered up

- **New Azure subscriptions start almost empty.** Expect to hit "resource provider not registered" at least once per resource *type* the first time you use it on a fresh subscription. The fix is always `az provider register --namespace <name> --wait`.
- **Some Azure resource properties are locked in at creation time** and simply cannot be changed by re-running your deployment — networking mode on Postgres Flexible Server was the one that bit us, but it's a general pattern worth watching for.
- **Changing a secret's *value* in Container Apps doesn't automatically restart anything.** You have to explicitly restart the revision.
- **Confusing Azure error messages are common enough that searching the exact error code (not just the words) is often faster than reasoning about what the sentence literally says.** `PrivateDnsZoneHasWrongZoneSuffix` is the clearest example from this session — the literal wording pointed the wrong direction.
- **When self-hosting someone else's product (like GoTrue), read carefully what the vendor assumes you're starting from.** GoTrue assuming a pre-existing Supabase-managed baseline schema was a completely reasonable design choice on their part — it just wasn't documented anywhere obvious, and only became clear from directly comparing which migrations succeeded against which ones the local dev environment had.
- **Docker Compose port numbers can mislead you.** The "external" port in someone else's `docker-compose.yml` is not necessarily the port their application actually listens on internally.

---

*Back to [00-overview.md](./00-overview.md) · Related: [06-phase3-auth-storage.md](./06-phase3-auth-storage.md) (the plan this log deviates from)*
