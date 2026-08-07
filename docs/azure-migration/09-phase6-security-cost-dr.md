# Phase 6 — Security, Observability, Cost, DR — Staging Proves the Wiring, Prod Gets the Real Alerts

**Goal:** replace every inline secret from Phases 2–5 with real Key Vault + Managed Identity wiring, add real alerting (prod gets paged, staging doesn't need to), and put a floor under disaster recovery.
**Ships app code:** No — additive hardening on top of an already-working system.
**Est. effort:** 2–3 days.

This phase turns "it works" into "it's actually production-grade." Every earlier phase deliberately used inline Container App secrets to stay focused — this is where that shortcut gets closed, in staging first (to prove the Bicep is right), then prod.

## 1. Reuse Phase 4's identity — don't create a second one

Phase 4 already created `id-vairis-app-${environmentName}` and granted it `AcrPull` on the shared registry, because the Container App needed that just to start. This phase doesn't create a new identity — it grants that *same* identity one more permission (`Key Vault Secrets User`, scoped to its own environment's vault) and switches the app's secrets from inline values to Key Vault references.

Add the role assignment to the Key Vault module (the `principalId` param has been sitting unused there since Phase 0 — this is where it finally gets consumed):

```bicep
// in infra/modules/keyvault.bicep — add this resource, using the principalId param already defined there
resource kvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(kv.id, principalId, 'KeyVaultSecretsUser')
  scope: kv
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
  }
}
```

Update the existing `keyVault` module call in `main.bicep` (unchanged since Phase 0 except this one line) to finally pass the real identity instead of an empty placeholder:

```bicep
module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    principalId: identity.outputs.principalId   // ← was '', now points at Phase 4's identity module
  }
}
```

## 2. Populate secrets, reference them from Key Vault instead of inline

Full mapping from LAUNCH.md §1, updated for the post-migration world — every "Yes" row moves into Key Vault, in **both** environments, with environment-appropriate values (staging uses Razorpay/Resend **test** credentials, prod uses live ones):

| Env var | Key Vault? | New source |
|---|---|---|
| `DATABASE_URL` / `DIRECT_DATABASE_URL` | Yes | Azure Postgres, per environment (Phase 2) |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | No (public) | GoTrue endpoint + regenerated anon JWT, per environment (Phase 3) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Regenerated service-role JWT, per environment |
| `AZURE_STORAGE_CONNECTION_STRING` | Yes | Blob Storage, per environment (Phase 3) |
| `RAZORPAY_KEY_ID` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` | No (public-ish) | Test keys in staging, live in prod |
| `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Yes | Test in staging, live in prod |
| `PAYMENT_GATEWAY` | No (config) | Unchanged |
| `NEXT_PUBLIC_CHECKOUT_ENABLED` | No (public flag) | Unchanged |
| `SHIPPING_PROVIDER` | No (config) | Unchanged |
| `RESEND_API_KEY` | Yes | Unchanged (same Resend account can serve both, or a second key for staging if you want inbox separation) |
| `EMAIL_FROM` / `ADMIN_EMAILS` / `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_THEME` | No (config) | Per-environment domain in `NEXT_PUBLIC_APP_URL` |
| `GOLD_SYNC_SECRET` / `METAL_PRICE_API_KEY` / `ORDER_SWEEP_SECRET` | Yes | Unchanged, separate secret values per environment |
| `RETURN_WINDOW_DAYS` / `ORDER_EXPIRY_HOURS` | No (config) | Unchanged |
| `GOTRUE_JWT_SECRET` | Yes | Per environment (Phase 3) |
| `NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING` | No (write-only ingestion key) | Per environment (Phase 1) |

```bash
azd env select staging
az keyvault secret set --vault-name kv-vairis-staging --name database-url --value "$(azd env get-value POSTGRES_STAGING_CONNECTION_STRING)"
# ...repeat for every "Yes" row, staging values...

azd env select prod
az keyvault secret set --vault-name kv-vairis-prod --name database-url --value "$(azd env get-value POSTGRES_PROD_CONNECTION_STRING)"
# ...repeat, prod values...
```

Update the `secretRefs` array **in `main.bicep`**, where it's built before being passed into the `app` module call, to use `keyVaultUrl` references instead of inline values — `keyVault.outputs.keyVaultUri` is already in scope there from Phase 0's module:
```bicep
var appSecretRefs = [
  { name: 'database-url', keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/database-url', identity: identity.outputs.identityId }
  { name: 'razorpay-key-secret', keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/razorpay-key-secret', identity: identity.outputs.identityId }
  // ...one entry per "Yes" row in the table above
]

module app 'modules/app.bicep' = {
  name: 'app'
  scope: rg
  params: {
    // ...existing params...
    secretRefs: appSecretRefs
  }
}
```

```bash
azd env select staging
azd provision
# confirm the app still starts cleanly reading secrets via the new path
azd env select prod
azd provision
```

## 3. Monitoring — prod gets real alerts, staging doesn't need to page anyone

```bicep
// infra/modules/alerts.bicep — only meaningfully used when environmentName == 'prod'
param environmentName string
param appId string
param actionGroupEmail string

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (environmentName == 'prod') {
  name: 'ag-vairis-prod'
  location: 'global'
  properties: {
    groupShortName: 'vairisprod'
    enabled: true
    emailReceivers: [{ name: 'primary', emailAddress: actionGroupEmail, useCommonAlertSchema: true }]
  }
}

resource high5xx 'Microsoft.Insights/metricAlerts@2018-03-01' = if (environmentName == 'prod') {
  name: 'alert-high-5xx-prod'
  location: 'global'
  properties: {
    severity: 2
    scopes: [appId]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [{ name: 'high5xx', metricName: 'Requests', operator: 'GreaterThan', threshold: 10, timeAggregation: 'Count' }]
    }
    actions: [{ actionGroupId: actionGroup.outputs.id }]
  }
}
```

Staging deliberately skips real alert rules (the `if (environmentName == 'prod')` conditions above) — a noisy rehearsal environment paging you at 2am defeats the purpose of having a safe place to break things. Staging still has App Insights (Phase 1) for on-demand debugging, just no proactive alerting.

Starter KQL query (Log Analytics) for order-lifecycle errors in prod, since that's the highest-stakes code path:
```kql
traces
| where message contains "order" and severityLevel >= 3
| order by timestamp desc
| take 50
```

## 4. Cost review

Rough monthly estimate — **prod** at current low traffic, **staging** assuming it's mostly scaled-to-zero between rehearsals:

| Resource | Prod tier | Staging tier | Notes |
|---|---|---|---|
| Container Apps (web) | Consumption, min 1 replica | Consumption, min 0 | Staging costs ~nothing when idle |
| Container Apps (auth) | Consumption, min 1 | Consumption, min 0 | Same |
| Azure DB for PostgreSQL | Burstable B1ms | Burstable B1ms | Same tier both — DB cost doesn't scale down as cleanly as compute, so staging's DB is the biggest "wasted" line item if left running; see note below |
| Blob Storage | Standard ZRS | Standard LRS | Staging deliberately cheaper (no zone redundancy needed for rehearsal data) |
| Front Door | Premium | Premium | Both need Premium for managed WAF rules — the single biggest shared cost |
| Key Vault | Standard | Standard | Negligible either way |
| ACR | Basic | *(shared, no separate cost)* | One registry for both environments |

**If staging's idle cost bothers you:** `azd env select staging && azd down` between rehearsal sessions removes everything, and `azd env select staging && azd provision && azd deploy` rebuilds it from the same Bicep in minutes — this is the entire point of driving both environments from identical templates. Don't leave staging's database running 24/7 out of inertia if you're not actively rehearsing something.

**Don't buy Reserved Instances or Savings Plans yet** — those pay off at 1-3 year commitment horizons and prod hasn't proven steady-state traffic yet. Revisit after 3-6 months of real usage data.

## 5. Backup & disaster recovery — prod only, staging data is disposable by design

- **Postgres (prod):** confirm backup retention (Phase 2's Bicep already sets 14 days for prod, 7 for staging).
- **Blob Storage (prod):** enable soft-delete + versioning:
  ```bicep
  // add to storage.bicep, prod-only via the isProd pattern
  resource blobServiceProps 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
    parent: storageAccount
    name: 'default'
    properties: environmentName == 'prod' ? {
      deleteRetentionPolicy: { enabled: true, days: 14 }
      isVersioningEnabled: true
    } : {}
  }
  ```
- **Actually run a restore drill against prod's backup**, into a throwaway server — configuring backups and never testing a restore is the classic way DR plans fail silently. Costs an hour, buys real confidence. (Staging is disposable by design — rebuilding it from Bicep + a fresh Supabase dump *is* its DR plan, no separate drill needed.)
- **State explicit targets**, informally: **RPO ~24h**, **RTO ~4h** for prod — not tuned SLAs, a sanity baseline appropriate for a store this size. Revisit once real order volume exists.

## Verification checklist

- [ ] No secret exists as a plain inline Container App value in either environment — every sensitive value is a Key Vault reference
- [ ] Each environment's Managed Identity has exactly the permissions it needs (AcrPull on the shared registry, Secrets User on its own vault), nothing broader, and staging's identity cannot read prod's vault (verify: `az keyvault secret list --vault-name kv-vairis-prod` using the staging identity should fail)
- [ ] Prod alert rules fire correctly (test by temporarily lowering a threshold, then reset); staging has none
- [ ] Cost Management shows staging near-zero when idle, prod roughly matching the estimate table
- [ ] A real Postgres restore drill has been performed against prod's backup and documented

---

*Back to [00-overview.md](./00-overview.md) · Previous: [08-phase5-network-cicd.md](./08-phase5-network-cicd.md) · Next: [10-phase7-cutover-decommission.md](./10-phase7-cutover-decommission.md)*
