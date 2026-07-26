# Phase 0 — Foundations: azd project, both environments, shared ACR

**Goal:** a working `azd` project with two live, empty, correctly-isolated environments (`staging`, `prod`) and the shared registry/CI plumbing every later phase deploys through.
**Ships app code:** No.
**Est. effort:** 1 day.

Read [02-azd-and-resources-primer.md](./02-azd-and-resources-primer.md) first if you haven't — this phase assumes you know what `azd env`, `azd provision`, and the Bicep module layout mean.

## 1. Subscription, identity, break-glass (one-time, not azd-managed)

- Sign up at [azure.microsoft.com](https://azure.microsoft.com), redeeming startup credits during signup if you have them.
- **Don't use your personal Microsoft account as the long-term Owner.** A new subscription auto-creates a Microsoft Entra ID directory — add yourself as a proper user in it. AWS analogy: same "don't operate as the root account" advice, Entra ID plays the IAM Identity Center role.
- Create a **break-glass account**: a second Entra ID user with Owner rights, credentials stored outside your daily-driver auth. Five minutes, cheap insurance.

## 2. Install tooling

```bash
brew install azure-cli azd docker
az login
azd auth login
```

Sanity check:
```bash
az account show
azd version
```

## 3. Budget alert (subscription-wide, do this before anything costs money)

This is genuinely global, not per-environment — set it once:

Azure Portal → Cost Management → Budgets → monthly budget scoped to the subscription, alerts at 50/80/100% of your credit allocation, emailed to yourself.

## 4. Scaffold the azd project

In the Vairis repo root:

```bash
mkdir -p infra/modules
```

`azure.yaml` (repo root) — the manifest azd reads to know what to deploy. Only the `web` service exists yet; Phase 3 adds `auth` (GoTrue), Phase 4 fills in `web`'s real config:

```yaml
# azure.yaml
name: vairis
metadata:
  template: vairis-azure-migration
services:
  web:
    project: .
    host: containerapp
    language: js
    docker:
      path: ./Dockerfile
```

`infra/main.bicep` — the entrypoint. Every phase adds a module call here; right now it only creates the resource group itself:

```bicep
// infra/main.bicep
targetScope = 'subscription'

@minLength(1)
@maxLength(20)
@description('azd environment name (staging or prod) — becomes part of every resource name')
param environmentName string

@minLength(1)
@description('Azure region for all resources')
param location string

@description('True when deploying the prod environment — lets modules size themselves differently per environment')
var isProd = environmentName == 'prod'

var resourceGroupName = 'rg-vairis-${environmentName}'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: {
    env: environmentName
    project: 'vairis'
    'managed-by': 'azd'
  }
}

output AZURE_RESOURCE_GROUP string = rg.name
output ENVIRONMENT_IS_PROD bool = isProd
```

`infra/main.parameters.json` — maps azd's built-in environment variables to the Bicep parameters above:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": { "value": "${AZURE_ENV_NAME}" },
    "location": { "value": "${AZURE_LOCATION}" }
  }
}
```

Commit this skeleton now — every later phase's diffs build on it.

## 5. Create both environments

```bash
azd env new staging
azd env set AZURE_LOCATION centralindia
azd env new prod
azd env set AZURE_LOCATION centralindia
```

(`centralindia` / `southindia` — pick whichever has better latency to your actual users; both are reasonable analogs to Supabase's `ap-south-1`. Use the same region for both environments unless you have a specific reason not to.)

Check both exist, independently:
```bash
azd env list
# NAME      DEFAULT
# staging   false
# prod      true      (whichever you created/selected last)
```

Each environment's parameter values live in `.azure/<name>/.env` — **do not hand-edit these directly**, always go through `azd env set` so azd's own tracking stays consistent. Add `.azure/` to `.gitignore` if it isn't already — these files can contain resolved secrets/connection strings from later phases and must never be committed.

Try the first deploy, for each environment, to prove the loop end-to-end before any later phase adds real resources:

```bash
azd env select staging
azd provision
# → creates rg-vairis-staging, empty except the resource group itself

azd env select prod
azd provision
# → creates rg-vairis-prod, same
```

```bash
az group list --output table
```
Should show `rg-vairis-staging` and `rg-vairis-prod`, both created from the *same* Bicep, with only `environmentName` differing. This is the pattern every later phase repeats.

## 6. Shared Azure Container Registry (one-time, not azd-managed)

ACR is the one resource deliberately **not** duplicated per environment (see the primer for why) — create it directly, outside the azd environment lifecycle:

```bash
az group create --name rg-vairis-shared --location centralindia

az acr create \
  --name vairisacr \
  --resource-group rg-vairis-shared \
  --sku Basic \
  --admin-enabled false
```

`--admin-enabled false` — Container Apps authenticates to ACR via Managed Identity (Phase 4), not the registry's built-in admin username/password. Keep it off.

Tell both environments where the shared registry lives:

```bash
azd env select staging
azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT vairisacr.azurecr.io

azd env select prod
azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT vairisacr.azurecr.io
```

## 7. Key Vault — one per environment

Unlike ACR, Key Vault is per-environment (staging secrets and prod secrets must never share a vault). Add the module now, even though nothing uses it until Phase 2:

```bicep
// infra/modules/keyvault.bicep
param location string
param environmentName string
param principalId string  // the Container App's managed identity (created Phase 4), granted access here in Phase 6 — empty for now

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-vairis-${environmentName}'
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true   // Azure RBAC, not the legacy access-policy model
  }
  tags: { env: environmentName, project: 'vairis' }
}

output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
```

Wire it into `main.bicep` (this pattern — a module scoped to the resource group just created — repeats for every module in every later phase):

```bicep
// append to infra/main.bicep, below the `resource rg` block
module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    principalId: ''  // wired to a real identity in Phase 6, once Phase 4's identity module exists
  }
}

output KEY_VAULT_NAME string = keyVault.outputs.keyVaultName
```

```bash
azd env select staging
azd provision
azd env select prod
azd provision
```

Verify: `az keyvault list --resource-group rg-vairis-staging --output table` and the same for `rg-vairis-prod` each show one vault, named `kv-vairis-staging` / `kv-vairis-prod` respectively.

## 8. GitHub Actions CI/CD — `azd pipeline config`

This one command replaces what used to be a hand-written OIDC App Registration + federated credential + GitHub Actions YAML: it creates the App Registration, the federated identity credential trusting your repo, and a starter workflow, in one shot.

```bash
azd env select staging
azd pipeline config
```

Follow the prompts (it'll ask which GitHub repo, confirm the environment). This generates `.github/workflows/azure-dev.yml`, wired to deploy the `staging` environment.

Repeat for prod, but since `azd pipeline config` generates one workflow file per invocation, rename the first before running it again so the second doesn't overwrite it:

```bash
mv .github/workflows/azure-dev.yml .github/workflows/azure-dev-staging.yml
# edit the trigger in azure-dev-staging.yml to `on: push: branches: [staging]`

azd env select prod
azd pipeline config
mv .github/workflows/azure-dev.yml .github/workflows/azure-dev-prod.yml
# edit the trigger in azure-dev-prod.yml to `on: push: branches: [master]`
```

Both workflows now authenticate via their own federated credential (scoped to their own branch — check this in the generated `AZURE_CLIENT_ID` GitHub secret/variable per environment, `azd pipeline config` sets these as GitHub *environment* variables named `staging` and `prod` if you let it, keeping them cleanly separated) and run `azd deploy` against their respective environment. No workflow YAML to hand-write, no client secret anywhere.

## Verification checklist

- [ ] `azd env list` shows both `staging` and `prod`
- [ ] `az group list` shows `rg-vairis-staging`, `rg-vairis-prod`, and `rg-vairis-shared`
- [ ] `vairisacr` exists in `rg-vairis-shared`, admin access disabled
- [ ] A Key Vault exists in each per-environment resource group, correctly named
- [ ] Both GitHub Actions workflows exist, each scoped to its own branch, and a trivial push triggers a successful (empty) `azd deploy` run in the right environment

## Rollback

Nothing here is load-bearing yet — `azd down` on either environment (or `az group delete`) undoes everything with zero customer impact.

---

*Back to [00-overview.md](./00-overview.md) · Previous: [02-azd-and-resources-primer.md](./02-azd-and-resources-primer.md) · Next: [04-phase1-observability-storage-dryrun.md](./04-phase1-observability-storage-dryrun.md)*
