# Phase 2 — Database, Staging Rehearsal Then Prod Cutover

**Goal:** stand up Azure Database for PostgreSQL Flexible Server in both environments; fully rehearse the migration against staging (including pointing a real Vercel Preview Deployment at it); only then do the real prod cutover.
**Ships app code:** No — the app's *deployment target* doesn't move yet (still Vercel), only which database it talks to.
**Est. effort:** 1–2 days (mostly the staging rehearsal; the prod cutover itself is fast because of it).

## Why this phase is simpler than it sounds

Standard database-migration advice reaches for logical replication / Azure Database Migration Service for near-zero-downtime cutovers. That machinery protects large, high-write-volume databases from long outages. Vairis has 23 products in prod and runs in WhatsApp-enquiry mode (checkout disabled) per CLAUDE.md — small, low-write. A `pg_dump`/`pg_restore` cutover with a few minutes of read-only downtime, rehearsed once in staging first, is the right-sized tool.

## 1. The database module

```bicep
// infra/modules/database.bicep
param location string
param environmentName string
param administratorLogin string
@secure()
param administratorPassword string
param subnetId string = ''   // empty until Phase 4 wires VNet integration; public access until then

var isProd = environmentName == 'prod'

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: 'psql-vairis-${environmentName}'
  location: location
  sku: {
    name: 'Standard_B1ms'      // Burstable — cheapest production-viable tier, both environments
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: { storageSizeGB: 32 }
    backup: {
      backupRetentionDays: isProd ? 14 : 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }   // both environments — HA is a Phase 6+ upgrade once traffic justifies it
    network: empty(subnetId) ? {
      publicNetworkAccess: 'Enabled'
    } : {
      publicNetworkAccess: 'Disabled'
      delegatedSubnetResourceId: subnetId
    }
  }
  tags: { env: environmentName, project: 'vairis' }
}

resource allowAllTemp 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = if (empty(subnetId)) {
  parent: postgres
  name: 'AllowAll-TEMPORARY'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '255.255.255.255' }
}

resource pgBouncerEnabled 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-06-01-preview' = {
  parent: postgres
  name: 'pgbouncer.enabled'
  properties: { value: 'true', source: 'user-override' }
}

resource pgBouncerMode 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-06-01-preview' = {
  parent: postgres
  name: 'pgbouncer.pool_mode'
  properties: { value: 'session', source: 'user-override' }   // session mode, not transaction — same reason Supabase's Session Pooler is mandatory today
}

output postgresHost string = postgres.properties.fullyQualifiedDomainName
```

**Why `pgbouncer.pool_mode = session` matters:** CLAUDE.md is explicit that Prisma must use Supabase's Session Pooler, never the Transaction Pooler, because transaction-mode pooling breaks Prisma's prepared statements. Azure Flexible Server's built-in PgBouncer has the identical failure mode with the identical fix — this Bicep module bakes the correct setting in from the start instead of leaving it as a step to remember.

**The `subnetId` parameter is deliberately empty for now** — the database is reachable over the public internet (TLS-required) in both environments until Phase 4 puts Container Apps and the database in the same VNet and re-runs this module with a real `subnetId`, which flips `publicNetworkAccess` to `Disabled` and removes the temporary allow-all firewall rule. Flag this explicitly: **this database is publicly reachable until Phase 4 closes it, in both environments.**

The admin password is a `@secure()` parameter — generate one per environment and store it as an azd environment secret, never in a file:

```bash
azd env select staging
azd env set POSTGRES_ADMIN_PASSWORD "$(openssl rand -base64 24)" --secret
azd env select prod
azd env set POSTGRES_ADMIN_PASSWORD "$(openssl rand -base64 24)" --secret
```

Wire into `main.bicep`:
```bicep
@secure()
param postgresAdminPassword string

module database 'modules/database.bicep' = {
  name: 'database'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    administratorLogin: 'vairisadmin'
    administratorPassword: postgresAdminPassword
  }
}

output POSTGRES_HOST string = database.outputs.postgresHost
```
Add the matching line to `infra/main.parameters.json`: `"postgresAdminPassword": { "value": "${POSTGRES_ADMIN_PASSWORD}" }`.

## 2. Provision staging, then rehearse the full migration against it

```bash
azd env select staging
azd provision
azd env get-values | grep POSTGRES_HOST
```

Back up Supabase first (same step, real reason, every time you touch prod data): **Supabase → Database → Backups → trigger a manual backup**, confirm it completes.

Dump from Supabase, restore into staging:
```bash
pg_dump "postgresql://postgres:<pw>@<supabase-direct-host>:5432/postgres" \
  --format=custom --no-owner --no-acl \
  --file=vairis-dump.custom

pg_restore \
  --dbname="postgresql://vairisadmin:<staging-pw>@psql-vairis-staging.postgres.database.azure.com:5432/postgres" \
  --no-owner --no-acl \
  vairis-dump.custom
```

Verify row counts match, table by table, between Supabase and staging (`SELECT count(*) FROM <table>` on both sides for every Prisma model) — cheap insurance against truncation/encoding issues. Spot-check enum columns (`OrderStatus` etc.) round-tripped correctly via `npx prisma studio` pointed at the staging connection string.

**Now go further than a raw SQL check — prove the actual app works against it.** Create a Vercel **Preview Deployment** (not production) with `DATABASE_URL`/`DIRECT_DATABASE_URL` overridden to staging's pooled/direct connection strings. Run the full LAUNCH.md §5 QA gate against that preview URL:
```bash
npm run lint && npx tsc --noEmit && npm run build
node scripts/_flow-test.mjs            # point its base URL at the preview deployment
node scripts/_order-lifecycle-test.mjs
node scripts/_crawl.mjs
```
This is the real value of doing staging first: by the time prod is touched, the exact application code has already run successfully against the exact database engine/config prod will use — not just a schema diff.

Iterate here freely. Found a Bicep mistake (wrong retention, wrong pooling mode)? Fix the module, `azd provision` again against staging, re-verify. This is the safe place to get it wrong.

## 3. Provision prod, do the real cutover

Once staging's rehearsal is clean:
```bash
azd env select prod
azd provision
azd env get-values | grep POSTGRES_HOST
```

Pick a quiet window (traffic is light given WhatsApp-enquiry mode, but off-hours is still politer):

1. **Freeze writes** informally — note in team WhatsApp "DB migration in progress," confirm nobody's mid-admin-action.
2. Fresh `pg_dump` from Supabase (data has moved since the staging rehearsal dump).
3. `pg_restore` into `psql-vairis-prod` (not staging).
4. Update **Vercel's production** env vars: `DATABASE_URL`/`DIRECT_DATABASE_URL` → prod's Azure connection strings. The app is still hosted on Vercel — only the database target changes.
5. Redeploy production.
6. Run the full LAUNCH.md §5 QA gate against the real production URL.
7. Manually browse the live site, confirm products load, admin login works, any existing orders display correctly.
8. Announce writes unfrozen.

## Rollback

**In staging:** nothing to roll back — it was never customer-facing. Iterate freely, `azd down`/`azd provision` as needed.

**In prod:** if anything looks wrong after step 5, revert the two env vars back to Supabase's values, redeploy. Supabase's data was only ever read from (`pg_dump`), never written to, so this is a clean, fast revert. Keep the Supabase project active (don't pause/delete) for at least a week post-cutover regardless of how clean it looks.

## Housekeeping after prod is confirmed stable

Update CLAUDE.md §3's "Supabase DB connection" section to describe the Azure connection details and the PgBouncer session-mode equivalent — don't do this until Phase 2 is proven stable in prod, but don't forget it either.

---

*Back to [00-overview.md](./00-overview.md) · Previous: [04-phase1-observability-storage-dryrun.md](./04-phase1-observability-storage-dryrun.md) · Next: [06-phase3-auth-storage.md](./06-phase3-auth-storage.md)*
