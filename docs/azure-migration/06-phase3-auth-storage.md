# Phase 3 — Auth & Storage, Staging First

**Goal:** stand up the network + Container Apps Environment (both environments will host every container from here on), self-host Supabase's GoTrue for auth inside it, close off the database's public access now that private networking exists, and cut storage over to native Azure Blob.
**Ships app code:** No (GoTrue is a prebuilt image; the Next.js app itself still runs on Vercel).
**Est. effort:** 3–5 days (auth is the harder half; do it in staging first, more than once if needed).

## The decision: two different answers for auth vs storage

### Auth: self-host GoTrue, don't switch to Entra External ID (yet)

**Option A — self-host GoTrue** (Supabase's open-source auth server) as a Container App, pointed at the Azure Postgres from Phase 2.
**Option B — rewrite auth using Microsoft Entra External ID.**

Option B means rewriting every auth call site — sign-up, sign-in, Google OAuth, password reset, session middleware — and reworking every Postgres RLS policy referencing `auth.uid()`/`auth.jwt()`, since those are Supabase-specific Postgres helper functions. That's a big-bang application rewrite bundled into an infra migration, contradicting "smooth transition," and nothing about Vairis today needs Entra's enterprise-SSO/B2B feature set.

**This roadmap recommends Option A.** `@supabase/supabase-js` and `@supabase/ssr` calls in the app don't change at all — only the URL they point to. RLS policies keep working. The migration stays infra-only. Revisit Option B later, as its own project, only if a real requirement shows up.

### Storage: go directly to native Azure Blob

Supabase's self-hosted Storage API needs a local-disk or S3-compatible backend — Azure Blob isn't S3-API-compatible, so self-hosting Storage would mean bolting on an S3-compatibility shim for no real benefit. The alternative — rewriting the storage call sites directly against `@azure/storage-blob` — has a small surface area (product image/video upload, gated by `SUPABASE_SERVICE_ROLE_KEY`, server-only, per CLAUDE.md):

```bash
grep -rn "\.storage\.from(" app lib
```

## Part A — Network + Container Apps Environment (both environments will share this for every future container)

```bicep
// infra/modules/network.bicep
param location string
param environmentName string

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'vnet-vairis-${environmentName}'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] }
    subnets: [
      {
        name: 'snet-container-apps'
        properties: {
          addressPrefix: '10.0.0.0/23'   // Container Apps needs a /23 minimum
          delegations: [{ name: 'Microsoft.App/environments', properties: { serviceName: 'Microsoft.App/environments' } }]
        }
      }
      {
        name: 'snet-database'
        properties: { addressPrefix: '10.0.2.0/24' }
      }
    ]
  }
  tags: { env: environmentName, project: 'vairis' }
}

output containerAppsSubnetId string = vnet.properties.subnets[0].id
output databaseSubnetId string = vnet.properties.subnets[1].id
```

```bicep
// infra/modules/containerapps-env.bicep
param location string
param environmentName string
param subnetId string
param logAnalyticsWorkspaceId string

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-vairis-${environmentName}'
  location: location
  properties: {
    vnetConfiguration: { infrastructureSubnetId: subnetId }
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: { customerId: reference(logAnalyticsWorkspaceId, '2023-09-01').customerId }
    }
  }
  tags: { env: environmentName, project: 'vairis' }
}

output environmentId string = env.id
output environmentDefaultDomain string = env.properties.defaultDomain
```

Wire both into `main.bicep`, and **update the existing `database` module call** to pass the new subnet — this is the one retroactive edit this phase makes to Phase 2's module, closing the "temporarily public" gap called out there:

```bicep
module network 'modules/network.bicep' = {
  name: 'network'
  scope: rg
  params: { location: location, environmentName: environmentName }
}

module containerAppsEnv 'modules/containerapps-env.bicep' = {
  name: 'containerapps-env'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    subnetId: network.outputs.containerAppsSubnetId
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId   // from Phase 1's module
  }
}

// EDIT the existing database module block from Phase 2 — add this one line:
module database 'modules/database.bicep' = {
  name: 'database'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    administratorLogin: 'vairisadmin'
    administratorPassword: postgresAdminPassword
    subnetId: network.outputs.databaseSubnetId   // ← new: flips publicNetworkAccess to Disabled
  }
}
```

Staging first:
```bash
azd env select staging
azd provision
```
This one deploy does three things at once: creates the VNet, creates the Container Apps Environment inside it, and **re-provisions the staging database with public access now disabled**, going through a private endpoint instead. Verify the staging app-tier can still reach the database before moving on — the next section's GoTrue deploy is exactly that verification, since GoTrue needs DB connectivity to start successfully.

## Part B — Self-hosted GoTrue

```bicep
// infra/modules/gotrue.bicep
param location string
param environmentName string
param containerAppsEnvironmentId string
param postgresConnectionString string
@secure()
param jwtSecret string
param siteUrl string
param googleClientId string
@secure()
param googleClientSecret string

resource gotrue 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'gotrue-vairis-${environmentName}'
  location: location
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      ingress: { external: true, targetPort: 9999 }
      secrets: [
        { name: 'db-url', value: postgresConnectionString }
        { name: 'jwt-secret', value: jwtSecret }
        { name: 'google-secret', value: googleClientSecret }
      ]
    }
    template: {
      containers: [
        {
          name: 'gotrue'
          image: 'supabase/gotrue:latest'
          env: [
            { name: 'GOTRUE_DB_DRIVER', value: 'postgres' }
            { name: 'DATABASE_URL', secretRef: 'db-url' }
            { name: 'GOTRUE_SITE_URL', value: siteUrl }
            { name: 'GOTRUE_JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'GOTRUE_JWT_EXP', value: '3600' }
            { name: 'GOTRUE_EXTERNAL_GOOGLE_ENABLED', value: 'true' }
            { name: 'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID', value: googleClientId }
            { name: 'GOTRUE_EXTERNAL_GOOGLE_SECRET', secretRef: 'google-secret' }
            { name: 'GOTRUE_MAILER_AUTOCONFIRM', value: 'false' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: environmentName == 'prod' ? 2 : 1 }
    }
  }
  tags: { env: environmentName, project: 'vairis' }
}

output gotrueUrl string = 'https://${gotrue.properties.configuration.ingress.fqdn}'
```

Every value in the `secrets` block above should be an azd environment secret (`azd env set ... --secret`), same pattern as Phase 2's `POSTGRES_ADMIN_PASSWORD` — generate a fresh `GOTRUE_JWT_SECRET` per environment, never reuse staging's in prod.

**Regenerate the Supabase client keys to match:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are JWTs signed with the project's JWT secret, carrying a `role` claim (`anon` / `service_role`). Since each environment gets its own fresh `GOTRUE_JWT_SECRET`, mint matching keys per environment (a JWT library or a one-off `jwt.io` session is fine for this non-recurring task).

**Install Supabase's Postgres helper schema** in each environment's database before pointing GoTrue at it — the `auth.uid()`/`auth.role()` SQL functions RLS policies rely on come from Supabase's own Postgres migrations, not GoTrue itself. Pull them from the [self-hosting guide](https://supabase.com/docs/guides/self-hosting) or the `supabase/postgres` image, run once against staging's database, then once against prod's.

Wire the Bicep as shown above. For `azure.yaml`, GoTrue is a published image azd should deploy as-is rather than build from a local Dockerfile — this is a less common azd path than the `web` service's build-from-source flow, so double-check the exact key against the current `azd` CLI version's schema (`azd config schema` or the [azd services reference](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/azd-schema)) before relying on it verbatim; the shape as of writing is:
```yaml
# azure.yaml — add alongside `web`
services:
  auth:
    project: .
    host: containerapp
    language: js
    image: supabase/gotrue:latest   # published image — azd deploys it directly, doesn't build a Dockerfile for this service
```
If that key has moved by the time you get here, the fallback that always works regardless of azd's exact schema for this case: skip `azd deploy` for the `auth` service entirely and let `azd provision` (plain Bicep) own the GoTrue Container App's image field directly, as pinned in `gotrue.bicep` above — GoTrue's image never needs rebuilding the way the Next.js app's does, so it doesn't lose much by being provision-managed instead of deploy-managed.

```bash
azd env select staging
azd provision
```

Test against staging: sign up, sign in, Google OAuth (add the staging GoTrue callback URL to Google Cloud Console's authorized redirects alongside the existing Supabase one), password reset, all pointed at a Vercel Preview Deployment with `NEXT_PUBLIC_SUPABASE_URL` overridden to staging GoTrue's URL and the regenerated staging anon/service keys. Iterate here — this is the harder half of the whole roadmap, and staging is exactly where you want to be iterating.

Once staging's auth flow is solid end-to-end:
```bash
azd env select prod
azd provision
```
Add prod's GoTrue callback URL to Google Cloud Console. Cut prod's Vercel env vars over the same way, on a preview deployment first, then production. **Every existing user session gets invalidated** by the new JWT secret — fine given the app's current pre-launch/WhatsApp-enquiry-mode traffic (per CLAUDE.md), but worth a heads-up if there's any active user base by the time you do this for real.

## Part C — Native Azure Blob Storage

The Phase 1 storage account (`vairis<env>media`) gets promoted from mirror to real use. Rewrite the call sites found via the earlier `grep`:

```ts
// Before (Supabase)
const { data, error } = await supabase.storage.from('product-media').upload(path, file, { contentType: file.type });
const { data: { publicUrl } } = supabase.storage.from('product-media').getPublicUrl(path);

// After (Azure Blob)
import { BlobServiceClient } from '@azure/storage-blob';
const blobService = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!);
const container = blobService.getContainerClient('product-media');

async function uploadProductMedia(path: string, file: Buffer, contentType: string) {
  const blockBlob = container.getBlockBlobClient(path);
  await blockBlob.uploadData(file, { blobHTTPHeaders: { blobContentType: contentType } });
  return blockBlob.url;
}
async function deleteProductMedia(path: string) {
  await container.getBlockBlobClient(path).deleteIfExists();
}
```

Test against staging's storage account and staging Vercel Preview Deployment first (upload/delete/list in the admin product editor and site-content editor), then repeat against prod.

## Verification checklist

- [ ] VNet + Container Apps Environment exist in both `rg-vairis-staging` and `rg-vairis-prod`
- [ ] Postgres public network access is `Disabled` in both environments, reachable only via private endpoint — confirm a direct `psql` from your laptop now fails against both
- [ ] Sign up, sign in, Google OAuth, password reset all work against staging GoTrue via a Vercel Preview Deployment, then the same against prod GoTrue via production
- [ ] RLS-gated queries return correct per-user data in both environments (spot-check wishlist/orders as a logged-in non-admin user)
- [ ] Product image/video upload, display, delete work against both storage accounts

## Rollback

**Staging:** nothing customer-facing depends on it — iterate freely.
**Prod:** revert `NEXT_PUBLIC_SUPABASE_URL` + keys / `AZURE_STORAGE_CONNECTION_STRING` back to Supabase's values on the production Vercel deployment, redeploy. Supabase Auth/Storage were never disabled, so this is immediate. Keep both live for at least a week post-cutover.

---

*Back to [00-overview.md](./00-overview.md) · Previous: [05-phase2-database.md](./05-phase2-database.md) · Next: [07-phase4-compute.md](./07-phase4-compute.md)*
