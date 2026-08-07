# Phase 4 — Compute: Next.js on Container Apps, Staging First

**Goal:** get the actual Next.js app running as a Container App inside the environment Phase 3 built, in staging, verified end-to-end via `azd deploy` — then repeat in prod. Prod still runs on a temporary Container Apps URL here; Vercel keeps serving the real domain until Phase 5.
**Ships app code:** Yes — this is the first phase where `azd deploy` matters, not just `azd provision`.
**Est. effort:** 2–3 days.

## Why Container Apps over App Service or Static Web Apps

- **`sharp`** (native image-processing dependency, already in `package.json`) is compiled per-platform. A container you build yourself has no ambiguity about whether the right system libraries are present — App Service's managed Node runtime doesn't guarantee this.
- **Azure Static Web Apps'** Next.js "hybrid" support has real caveats around ISR, middleware, and API routes that don't map cleanly onto Vairis's usage (force-dynamic API routes, `revalidate = 60` on PDPs).
- **Container Apps' consumption pricing** fits a low-traffic, pre-launch store better than App Service's always-on plans, and scales staging down to near-nothing between rehearsals.

## 1. Containerize the app

`next.config.ts`:
```ts
const nextConfig = {
  output: 'standalone',
  // ...existing config
};
```

`Dockerfile` (repo root — `azure.yaml`'s `web` service already points here from Phase 0):
```dockerfile
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* vars are baked into the client bundle at build time — must be
# build-args, not just runtime env vars, or the browser bundle ships with
# empty/undefined values. azd passes these automatically if they're declared
# as azd environment values (step 3 below).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG NEXT_PUBLIC_CHECKOUT_ENABLED
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_THEME
ARG NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID \
    NEXT_PUBLIC_CHECKOUT_ENABLED=$NEXT_PUBLIC_CHECKOUT_ENABLED \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SITE_THEME=$NEXT_PUBLIC_SITE_THEME \
    NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING=$NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone binds to 127.0.0.1 by default — Container Apps sends traffic
# from outside the loopback interface, so this must be 0.0.0.0 or every request
# silently fails with no obvious error in the logs.
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

Health check route (Container Apps' probes and Phase 5's Front Door both need something to hit):
```ts
// app/api/health/route.ts
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json({ ok: true });
}
```

## 2. A Managed Identity, so the app can pull its own image

The Container App needs to authenticate to the shared ACR to pull the image `azd deploy` pushes — that means it needs a real identity with `AcrPull` rights *before* the app can start, not later. Create both here; Phase 6 comes back to this same identity and *adds* Key Vault access to it, it doesn't create a second one.

```bicep
// infra/modules/identity.bicep
param location string
param environmentName string

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-vairis-app-${environmentName}'
  location: location
  tags: { env: environmentName, project: 'vairis' }
}

output identityId string = identity.id
output principalId string = identity.properties.principalId
```

```bicep
// infra/modules/acr-access.bicep — deployed with `scope: resourceGroup('rg-vairis-shared')`,
// since ACR lives in the one resource group that's shared across both environments
param principalId string
param acrName string

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: acrName
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, principalId, 'AcrPull')
  scope: acr
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // built-in AcrPull role
  }
}
```

Wire into `main.bicep`:
```bicep
module identity 'modules/identity.bicep' = {
  name: 'identity'
  scope: rg
  params: { location: location, environmentName: environmentName }
}

module acrAccess 'modules/acr-access.bicep' = {
  name: 'acr-access'
  scope: resourceGroup('rg-vairis-shared')
  params: { principalId: identity.outputs.principalId, acrName: 'vairisacr' }
}
```

## 3. The Container App module

```bicep
// infra/modules/app.bicep
param location string
param environmentName string
param containerAppsEnvironmentId string
param containerRegistryEndpoint string
param userAssignedIdentityId string   // from the identity module above
param appInsightsConnectionString string
param secretRefs array   // [{ name: 'database-url', value: '...' }, ...] — Phase 6 moves these to Key Vault references

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'vairis-app-${environmentName}'
  location: location
  tags: { env: environmentName, project: 'vairis', 'azd-service-name': 'web' }   // ← this tag is how azd knows which resource `web` deploys to
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${userAssignedIdentityId}': {} }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      ingress: { external: true, targetPort: 3000 }
      registries: [{ server: containerRegistryEndpoint, identity: userAssignedIdentityId }]
      secrets: secretRefs
    }
    template: {
      containers: [
        {
          name: 'web'
          image: '${containerRegistryEndpoint}/vairis-web:latest'   // azd overwrites this with the real tag on every `azd deploy`
          env: [
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
            // one entry per secretRef, e.g.:
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'RAZORPAY_KEY_SECRET', secretRef: 'razorpay-key-secret' }
            // ...remaining server-only secrets, same pattern
          ]
        }
      ]
      scale: {
        minReplicas: environmentName == 'prod' ? 1 : 0   // prod avoids cold starts; staging scales to zero between rehearsals
        maxReplicas: environmentName == 'prod' ? 3 : 1
      }
    }
  }
}

output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
```

This is the first module that needs the shared registry's endpoint as an actual Bicep value, not just an azd environment variable — add it to `main.bicep`'s param list and `main.parameters.json`, the same pattern Phase 0 used for `environmentName`/`location`:
```bicep
// add to main.bicep's param block
param containerRegistryEndpoint string
```
```json
// add to main.parameters.json's "parameters" object
"containerRegistryEndpoint": { "value": "${AZURE_CONTAINER_REGISTRY_ENDPOINT}" }
```

Wire into `main.bicep`, passing the identity created in step 2 above (`secretRefs` is still inline literal values here — Phase 6 comes back and swaps this for Key Vault references on the same module call, it doesn't restructure it):

```bicep
module app 'modules/app.bicep' = {
  name: 'app'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    containerAppsEnvironmentId: containerAppsEnv.outputs.environmentId   // from Phase 3
    containerRegistryEndpoint: containerRegistryEndpoint                 // azd env value from Phase 0
    userAssignedIdentityId: identity.outputs.identityId
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString   // from Phase 1
    secretRefs: [
      { name: 'database-url', value: postgresConnectionString }
      { name: 'razorpay-key-secret', value: razorpayKeySecret }
      // ...remaining server-only secrets, same pattern — inline for now, Key-Vault-ified in Phase 6
    ]
  }
}

output APP_URL string = app.outputs.appUrl
```

**`min-replicas: 0` for staging, `1` for prod** — this is the first place `isProd`-style branching actually saves money: staging costs nothing between rehearsal sessions instead of running an idle replica 24/7.

**On ISR with multiple prod replicas:** Vairis's PDPs use `revalidate = 60`. Next.js's default ISR cache is per-instance — with `maxReplicas: 3` in prod, each replica has its own cache, so a revalidation on one doesn't invalidate another's stale copy. At this traffic level (early-stage store, 60s window), this is low-stakes — worst case a customer sees a page up to ~60-90s more stale than intended in the rare case they hit a different replica right after a revalidation. Don't build around this now; if traffic later justifies running >1 replica most of the time, the fix is a custom Next.js cache handler backed by Azure Cache for Redis, shared across replicas — a Phase 6+ optimization, not a blocker here.

## 4. Give azd the build-time values it needs

```bash
azd env select staging
azd env set NEXT_PUBLIC_SUPABASE_URL "<staging GoTrue URL from Phase 3>"
azd env set NEXT_PUBLIC_SUPABASE_ANON_KEY "<staging anon key from Phase 3>"
azd env set NEXT_PUBLIC_RAZORPAY_KEY_ID "rzp_test_..."
azd env set NEXT_PUBLIC_CHECKOUT_ENABLED "false"
azd env set NEXT_PUBLIC_APP_URL "https://placeholder.staging"   # real value once Phase 5 assigns a domain
azd env set NEXT_PUBLIC_SITE_THEME "light"
```
`azd` automatically forwards every `azd env set` value it recognizes as a Dockerfile `ARG` at build time — no separate CI secret wiring needed beyond what's already in the environment.

## 5. Deploy to staging, verify, then prod

```bash
azd env select staging
azd provision   # creates vairis-app-staging inside the already-VNet-integrated environment from Phase 3
azd deploy       # builds the Dockerfile, pushes to the shared ACR, updates the Container App
```

```bash
azd env get-values | grep -i url
curl -sf https://<staging-app-url>/api/health
```

Run the full LAUNCH.md §5 QA gate against the staging Container Apps URL directly (point the test scripts' base URL at it, not Vercel):
```bash
npm run lint && npx tsc --noEmit && npm run build
node scripts/_flow-test.mjs
node scripts/_order-lifecycle-test.mjs
node scripts/_crawl.mjs
```

Once staging is clean, repeat for prod (still not customer-facing — Vercel serves the real domain until Phase 5):
```bash
azd env select prod
azd env set NEXT_PUBLIC_SUPABASE_URL "<prod GoTrue URL>"
azd env set NEXT_PUBLIC_SUPABASE_ANON_KEY "<prod anon key>"
azd env set NEXT_PUBLIC_RAZORPAY_KEY_ID "rzp_live_..."   # or still rzp_test_... if not yet live
azd env set NEXT_PUBLIC_APP_URL "https://placeholder.prod"
azd provision
azd deploy
```

Same QA gate, against the prod Container Apps URL this time.

## 6. Vercel Analytics

`@vercel/analytics` becomes an inert no-op once traffic isn't flowing through Vercel — harmless to leave in `package.json` through this phase, since nothing here removes Vercel from serving production yet. Formal removal happens in Phase 7's cleanup.

## Verification checklist

- [ ] `vairis-app-staging` serves the full site correctly at its Container Apps URL; `azd deploy` against staging completes cleanly
- [ ] `vairis-app-prod` does the same
- [ ] `/api/health` returns 200 in both
- [ ] Full LAUNCH.md §5 QA gate green against both Container Apps URLs
- [ ] Vercel is completely untouched and still serving real production traffic

## Rollback

Nothing to roll back on the Vercel side — it was never touched. `azd env select staging && azd down` (or prod) removes the Container App with zero customer-facing consequence.

---

*Back to [00-overview.md](./00-overview.md) · Previous: [06-phase3-auth-storage.md](./06-phase3-auth-storage.md) · Next: [08-phase5-network-cicd.md](./08-phase5-network-cicd.md)*
