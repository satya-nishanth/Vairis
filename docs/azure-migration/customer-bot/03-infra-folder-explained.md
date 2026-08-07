# The `infra/` Folder, Explained Line by Line

This doc walks through every file we added to the bot repo: `azure.yaml`, `infra/main.bicep`, `infra/resources.bicep`, and `infra/main.parameters.json`. Read [01-azure-concepts-for-beginners.md](./01-azure-concepts-for-beginners.md) first if terms like "resource group" or "Bicep" are new.

## The big idea: describe, don't click

Instead of manually clicking through the Azure Portal to create a container app, a registry, etc. — which is slow, unrepeatable, and leaves no record of *why* something is configured a certain way — we write files that **describe** the end state we want. A tool then compares that description to what currently exists in Azure and makes the difference. This is called **Infrastructure as Code (IaC)**. Azure's version of this is called **Bicep**.

Two upsides that matter for a bot maintained by one person: (1) if the bot's Azure resources are ever accidentally deleted, or you want to spin up a second copy for testing, these files fully recreate it — no memory required; (2) the files themselves are documentation. Six months from now, "why does the container have exactly 2GB of memory" is answered by reading `resources.bicep`, not by trying to remember.

## `azure.yaml` — the manifest

```yaml
name: vairis-customer-bot
metadata:
  template: vairis-customer-bot@0.1.0
services:
  bot:
    project: .
    language: js
    host: containerapp
    docker:
      path: ./Dockerfile
```

This file belongs to `azd` specifically (not plain Azure — `az` doesn't know this file exists). It answers one question: **"what are the deployable pieces of this app, and how does each one get built and where does it run?"**

- `name` — a label for the whole project, cosmetic.
- `services.bot` — declares one deployable unit, named `bot`. A more complex app might have multiple services here (e.g. a `web` frontend and an `api` backend) — this bot only has one.
- `project: .` — the service's code lives at the repo root.
- `language: js` — tells `azd` this is a JavaScript/Node.js project (affects some of its build heuristics).
- `host: containerapp` — the single most important line. This tells `azd` "when you deploy this service, target an Azure Container App" (as opposed to, say, an Azure Function or a Static Web App — `azd` supports several hosting targets, and this line picks one). This is what makes `azd deploy bot` know to build a Docker image and push it to a Container App, rather than doing something else entirely.
- `docker.path` — which Dockerfile to build. The bot repo already had a working `Dockerfile` (written for an earlier attempt to deploy to Render.com) — we reused it as-is.

## `infra/main.bicep` — the entry point

Every `azd` project's infra starts from a file literally named `main.bicep`. Ours:

```bicep
targetScope = 'subscription'
```
This line says "this template operates at the subscription level," meaning it's allowed to create resource groups themselves (a template scoped to a resource group can only create things *inside* an already-existing group). We need subscription scope because our very first job is creating the resource group.

```bicep
param environmentName string
param location string
@secure()
param discordBotToken string
param discordSupportChannelId string
param supabaseUrl string
@secure()
param supabaseKey string
param vairisStoreUrl string = 'https://www.thevairis.com'
param vairisReturnsUrl string = 'https://www.thevairis.com/returns'
```
`param` declares an input the template needs — think of these like function arguments. `@secure()` marks a parameter as sensitive: Azure won't log its value or show it in deployment history, and (in the `azd` flow) it gets stored more carefully. The two URL params have `= 'default value'` — if nothing is supplied, that default is used, which is why we didn't have to set `VAIRIS_STORE_URL` explicitly.

```bicep
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
```
`uniqueString(...)` is a built-in Bicep function: feed it some inputs, get back a short, deterministic, unique-looking string (`kcwsblmgxzvam` in our case). "Deterministic" means the *same* inputs always produce the *same* output — so re-running this template against the same subscription/environment/location always generates the same resource names, which is important for `azd` to reliably find its own resources later. We use this token as a suffix on every resource name so they don't collide with anything else in the subscription (Azure Container Registry names in particular must be globally unique across *all* of Azure, not just your subscription — this token is what makes `acrvairisbotkcwsblmgxzvam` practically guaranteed to be free).

```bicep
resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-vairis-bot-${environmentName}'
  location: location
  tags: tags
}
```
Creates the resource group itself. `${environmentName}` is string interpolation — since we only ever created the `prod` environment, this always resolved to `rg-vairis-bot-prod`. Note the `tags: { 'azd-env-name': environmentName }` — this tag is how `azd deploy` later *finds* this resource group without you telling it the exact name.

```bicep
module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: { ... }
}
```
A `module` is Bicep's way of including another file, similar to importing a function. `scope: rg` means "everything this module creates should live inside the resource group we just made." This is the line that hands off to `resources.bicep` — the file that actually declares every individual resource.

```bicep
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.registryEndpoint
output AZURE_RESOURCE_GROUP string = rg.name
output BOT_CONTAINER_APP_NAME string = resources.outputs.containerAppName
```
`output` values are how a Bicep template "returns" information after deployment — in our case, the registry's hostname and the two resource names, which we needed afterward to check on things via `az` commands.

## `infra/resources.bicep` — every actual resource

This is the file that does the real work. It's included by `main.bicep` via the `module` block above. Going through it top to bottom:

### Naming

```bicep
var containerAppName = 'ca-vairis-bot-${resourceToken}'
var identityName = 'id-vairis-bot-${resourceToken}'
var acrName = toLower('acrvairisbot${resourceToken}')
var storageAccountName = toLower('stvairisbot${resourceToken}')
var logAnalyticsName = 'log-vairis-bot-${resourceToken}'
var containerAppsEnvName = 'cae-vairis-bot-${resourceToken}'
```
Every resource name is built the same way: a short type prefix (`ca-` for Container App, `id-` for identity, `acr` for registry, `st` for storage, `log-` for Log Analytics, `cae-` for Container Apps Environment) plus the shared `resourceToken`. This prefix convention isn't an Azure requirement — it's a common community convention (borrowed from Microsoft's own "Cloud Adoption Framework" naming guidance) purely so that when you look at a resource list, the type is obvious from the name alone. Storage account and ACR names are additionally forced lowercase because those two resource types don't allow uppercase letters — a real Azure constraint, not a style choice.

```bicep
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
```
This is not a made-up ID — it's Azure's fixed, global identifier for the built-in **"AcrPull"** permission role (every built-in Azure role has one of these constant GUIDs, documented by Microsoft, the same across every subscription in the world). More on what it's used for below.

### The Managed Identity + permission grant

```bicep
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: tags
}
```
Creates an identity — think of it as a "robot user account" with no password, that Azure manages the credentials for automatically.

```bicep
resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identity.id, acrPullRoleId)
  scope: acr
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}
```
This is a **role assignment** — Azure's version of "grant this identity this specific permission on this specific resource." In plain English: *"the robot identity we just created is allowed to pull (download) images from this specific container registry, and nothing else."* This is the mechanism that lets the running container log into the private registry and download its own Docker image without any password or connection string sitting in a config file anywhere — a real security improvement over the alternative (a stored registry username/password).

### The registry

```bicep
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  ...
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}
```
`sku: Basic` is the cheapest ACR tier — plenty for one small app's images. `adminUserEnabled: false` explicitly disables ACR's alternative, weaker login method (a shared admin username/password baked into the registry itself) — we don't need it since the Managed Identity handles authentication instead, and leaving it enabled would just be an unused extra way for someone to get in.

### The storage account and file share

```bicep
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  ...
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}
resource fileServices 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' = { parent: storage; name: 'default' }
resource fileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileServices
  name: fileShareName
  properties: { shareQuota: 5 }
}
```
`Standard_LRS` means "Standard performance tier, Locally Redundant Storage" (your data is replicated three times within one physical data center — the cheapest redundancy option, appropriate for something that isn't irreplaceable business data). `shareQuota: 5` sets the file share's maximum size to 5 GiB — way more than a WhatsApp session needs, just a safe round number.

**Important caveat, covered in depth in doc 05:** this storage account and file share were *intended* to hold the bot's WhatsApp login session persistently across restarts. They were created successfully and are technically working exactly as configured — but the underlying protocol they use (SMB) turned out to be fundamentally incompatible with how the bot's Chrome browser needs to access files. So this resource currently exists, costs a small amount of money, and isn't actually being used by the running bot. Doc 06 covers what fixing this properly would involve.

### Wiring the storage into the Container Apps Environment

```bicep
resource envStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: containerAppsEnv
  name: 'wwebjs-auth-storage'
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: storage.listKeys().keys[0].value
      shareName: fileShareName
      accessMode: 'ReadWrite'
    }
  }
}
```
Before a Container App can mount a file share, the *Container Apps Environment* (the "neighborhood," from doc 01) has to know that file share exists and how to authenticate to it. `storage.listKeys()` is a Bicep function that reaches into the storage account's own access keys — one of the two admin credentials Azure generates automatically for every storage account — and hands the first one over so the Container Apps platform can use it to mount the share.

### The Container App itself

```bicep
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  tags: union(tags, { 'azd-service-name': 'bot' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
```
`union(tags, {...})` merges the environment-level tags (`azd-env-name: prod`) with a service-specific one (`azd-service-name: bot`) — this second tag is exactly what `azd deploy bot` uses to locate this specific Container App later, the same mechanism mentioned in doc 02. The `identity` block attaches the Managed Identity we created earlier to this specific container, so it can actually use the ACR-pull permission that was granted to it.

```bicep
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [ { server: acr.properties.loginServer, identity: identity.id } ]
      secrets: [
        { name: 'discord-bot-token', value: discordBotToken }
        { name: 'supabase-key', value: supabaseKey }
      ]
    }
```
`activeRevisionsMode: 'Single'` means "only one version of this app is ever running at a time" — the alternative, `Multiple`, is for doing gradual traffic-shifted rollouts between old and new versions, overkill for a single-instance bot. `registries` tells the platform which registry to pull from and which identity to authenticate with when doing so. `secrets` is Container Apps' separate, slightly-more-protected storage for sensitive values — note this is *not* the same thing as environment variables yet; a secret has to be explicitly referenced by an env var to actually reach the running process (see below).

```bicep
    template: {
      containers: [
        {
          name: 'bot'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: { cpu: json('1.0'), memory: '2Gi' }
```
The `image` here is a placeholder — Microsoft's public "hello world" sample image, used only so the Container App has *something* valid to start with the very first time it's created. `azd deploy` immediately overwrites this with the bot's real, freshly-built image — this is a standard, common pattern in `azd` templates, not a mistake or something you need to fix by hand. `cpu: 1.0` / `memory: '2Gi'` allocates 1 virtual CPU core and 2 gigabytes of RAM — deliberately generous compared to the 512MB the bot was fighting for on its earlier Render.com deployment (see doc 05 for why that mattered), since Chrome + Node.js together need real headroom.

```bicep
          env: [
            { name: 'SKIP_CHROME_INSTALL', value: '1' }
            ...
            { name: 'DISCORD_BOT_TOKEN', secretRef: 'discord-bot-token' }
            { name: 'SUPABASE_KEY', secretRef: 'supabase-key' }
          ]
```
Each entry becomes one environment variable inside the running container — exactly like a `.env` file, just declared here instead. Most are `value: '...'` — a plain, visible string. The two sensitive ones instead use `secretRef: 'discord-bot-token'` — this means "set this environment variable's value to whatever the secret named `discord-bot-token` currently holds," which is how the two Container-App-level secrets from earlier actually reach the running Node.js process as `process.env.DISCORD_BOT_TOKEN` etc.

```bicep
          volumeMounts: [
            { volumeName: 'wwebjs-auth', mountPath: '/app/.wwebjs_auth' }
          ]
        }
      ]
      volumes: [
        { name: 'wwebjs-auth', storageType: 'AzureFile', storageName: envStorage.name }
      ]
      scale: { minReplicas: 1, maxReplicas: 1 }
```
`volumeMounts`/`volumes` together are what would connect the file share to the container's filesystem at `/app/.wwebjs_auth` — this is the part that, as covered in doc 05, doesn't actually work for this particular app due to a filesystem-protocol incompatibility, so the running bot currently ignores this path (see the `WWEBJS_AUTH_PATH` override, explained just below) even though the mount itself is still configured and present. `scale: { minReplicas: 1, maxReplicas: 1 }` locks the container to *exactly* one running copy, always — never zero (which would mean "offline"), never more than one (which would mean two different Chrome instances fighting over the same WhatsApp login).

### The one line added *after* the initial deploy

```bicep
// whatsapp-web.js's Chrome profile can't live on the Azure Files (SMB) mount below —
// SMB's file locking breaks Puppeteer at launch ("Execution context was destroyed").
// Using local ephemeral disk until the mount is redone as Premium NFS: session state
// is lost on any container restart (crash, redeploy, host maintenance) and needs a
// fresh WhatsApp QR scan (posted to the Discord support channel) each time.
{ name: 'WWEBJS_AUTH_PATH', value: '/tmp/.wwebjs_auth' }
```
This single environment variable is the practical workaround for the failure described in detail in doc 05. `/tmp` is a directory that exists on the container's own local, temporary disk — not on the network file share. The bot's code (`index.js`) checks for this exact environment variable and, if set, stores its Chrome/WhatsApp session data there instead of the default path. This got the bot working *today*, at the cost of that session data disappearing if the container ever restarts. Doc 06 covers the proper long-term fix.

### Outputs

```bicep
output registryEndpoint string = acr.properties.loginServer
output containerAppName string = containerApp.name
```
Same idea as `main.bicep`'s outputs — these two values get passed back up to `main.bicep`, which re-exports them under the names `AZURE_CONTAINER_REGISTRY_ENDPOINT` and `BOT_CONTAINER_APP_NAME`.

## `infra/main.parameters.json` — where the secrets get plugged in

```json
{
  "parameters": {
    "environmentName": { "value": "${AZURE_ENV_NAME}" },
    "discordBotToken": { "value": "${DISCORD_BOT_TOKEN}" },
    "vairisStoreUrl": { "value": "${VAIRIS_STORE_URL=https://www.thevairis.com}" }
  }
}
```
This file is the bridge between "values `azd` has saved for this environment" and "parameters `main.bicep` expects." Each `${VAR_NAME}` is a placeholder `azd` fills in from that environment's saved config (the `.azure/prod/.env` file mentioned in doc 02) before running the deployment. The `${VAR=default}` form (see `vairisStoreUrl` above) means "use this saved value if one exists, otherwise fall back to this literal default." This file only matters to the `azd provision` command specifically — it's a piece of `azd`'s own convention, not something plain `az` understands, which is exactly why our workaround (running `az deployment sub create` directly) needed its own separate JSON file with the actual real values already filled in, rather than reusing this one — explained fully in doc 05.
