# Phase 1 — Observability + Storage, Staging First

**Goal:** get hands-on with the actual azd staging→prod rhythm on resources that can't hurt anything if you get them wrong — Application Insights (wired into the still-on-Vercel app) and a Blob Storage mirror of product media.
**Ships app code:** No.
**Est. effort:** 1 day.

Every later phase repeats this same shape: add a Bicep module → `azd env select staging` → `azd provision` → verify → `azd env select prod` → `azd provision` → verify. This phase is where you get that motion into muscle memory on something low-stakes.

## 1. Add the monitoring module

**Log Analytics Workspace** is the actual data store; **Application Insights** is the tracing/APM layer on top of it (see the [primer](./02-azd-and-resources-primer.md) if the distinction isn't clear). One pair per environment, so staging noise never pollutes prod alerting later.

```bicep
// infra/modules/monitoring.bicep
param location string
param environmentName string

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-vairis-${environmentName}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: environmentName == 'prod' ? 90 : 30
  }
  tags: { env: environmentName, project: 'vairis' }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-vairis-${environmentName}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
  tags: { env: environmentName, project: 'vairis' }
}

output logAnalyticsWorkspaceId string = logAnalytics.id
output appInsightsConnectionString string = appInsights.properties.ConnectionString
```

Wire into `main.bicep`:

```bicep
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
  }
}

output APPINSIGHTS_CONNECTION_STRING string = monitoring.outputs.appInsightsConnectionString
```

Staging first:
```bash
azd env select staging
azd provision
azd env get-values | grep APPINSIGHTS
```

Take that connection string and, for now, put it into **Vercel's** env vars (all environments) as `NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING` — the app is still hosted on Vercel at this point, App Insights works from any host:

```bash
npm install @microsoft/applicationinsights-web
```
```ts
// lib/telemetry/app-insights.ts
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

export const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING,
    enableAutoRouteTracking: true,
  },
});

if (typeof window !== 'undefined') {
  appInsights.loadAppInsights();
}
```

Deploy Vercel with the staging App Insights connection string, browse the site, confirm data lands in **Azure Portal → `appi-vairis-staging` → Live Metrics**. Once you're comfortable reading it:

```bash
azd env select prod
azd provision
azd env get-values | grep APPINSIGHTS
```

Swap Vercel's env var to the **prod** connection string (this is real production telemetry now, even though the app itself hasn't moved) and confirm the same in `appi-vairis-prod`.

## 2. Add the storage module

```bicep
// infra/modules/storage.bicep
param location string
param environmentName string

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'vairis${environmentName}media'   // no hyphens allowed, must be globally unique
  location: location
  sku: { name: environmentName == 'prod' ? 'Standard_ZRS' : 'Standard_LRS' }   // prod: zone-redundant; staging: cheaper, single-zone
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: true   // product images are meant to be publicly readable
  }
  tags: { env: environmentName, project: 'vairis' }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource productMediaContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'product-media'
  properties: {
    publicAccess: 'Blob'   // individual blobs readable via URL, container listing stays private
  }
}

output storageAccountName string = storageAccount.name
```

Wire in:
```bicep
module storage 'modules/storage.bicep' = {
  name: 'storage'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
  }
}

output AZURE_STORAGE_ACCOUNT_NAME string = storage.outputs.storageAccountName
```

```bash
azd env select staging
azd provision
```

Write a one-off mirror script (throwaway — `scripts/_azure-blob-mirror.mjs`, doesn't need to be production code) that lists everything in the Supabase Storage `product-media` bucket via `@supabase/supabase-js`, downloads each object, and re-uploads it to `vairisstagingmedia`'s `product-media` container via `@azure/storage-blob`, preserving the same path structure. Doesn't touch Supabase's side. Run it once against staging, spot-check a handful of images resolve.

Once satisfied the script and the path structure are right, repeat against prod:
```bash
azd env select prod
azd provision
```
Re-run the mirror script pointed at `vairisprodmedia` — this becomes the real one Phase 3 promotes to actual use, so make sure it's the freshest copy right before that phase's cutover, not this one.

## Verification checklist

- [ ] `appi-vairis-staging` and `appi-vairis-prod` both exist, both show live traffic from the (still Vercel-hosted) app when their respective connection string is active
- [ ] `vairisstagingmedia` and `vairisprodmedia` storage accounts both exist, each with a `product-media` container
- [ ] Mirror script run against both, spot-checked
- [ ] You can explain, in your own words, why ACR is shared but these two resource types are not (answer: images are already tagged/namespaced; secrets and monitoring data are not things you want staging and prod mixing)

## Rollback

Nothing here is load-bearing. `azd env select staging && azd down` (or the prod equivalent) removes it with zero customer impact — the mirrored Blob data is a copy, Supabase's originals are untouched either way.

---

*Back to [00-overview.md](./00-overview.md) · Previous: [03-phase0-foundations.md](./03-phase0-foundations.md) · Next: [05-phase2-database.md](./05-phase2-database.md)*
