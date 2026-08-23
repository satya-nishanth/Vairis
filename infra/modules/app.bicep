param location string
param environmentName string
param containerAppsEnvironmentId string
param containerRegistryEndpoint string
param userAssignedIdentityId string
param userAssignedIdentityPrincipalId string
param userAssignedIdentityClientId string
param appInsightsConnectionString string
param storageAccountName string
param secretRefs array
@description('Custom domain (e.g. www.thevairis.com) to bind to this app. Empty = no custom domain (staging).')
param customDomainFqdn string = ''
@description('Name of an existing managed certificate under the Container Apps Environment, matching customDomainFqdn. Must already be issued (DNS TXT/CNAME verified) before this deploys.')
param customCertificateName string = ''

var isProd = environmentName == 'prod'
var certificateResourceId = !empty(customCertificateName) ? resourceId('Microsoft.App/managedEnvironments/managedCertificates', 'cae-vairis-${environmentName}', customCertificateName) : ''
var customDomains = !empty(customDomainFqdn) ? [{ name: customDomainFqdn, certificateId: certificateResourceId, bindingType: 'SniEnabled' }] : []

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

// Storage Blob Data Contributor — lets the app's managed identity read/write/delete
// blobs via DefaultAzureCredential (lib/azure-blob.ts), no account keys involved.
resource storageBlobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, userAssignedIdentityPrincipalId, 'StorageBlobDataContributor')
  scope: storage
  properties: {
    principalId: userAssignedIdentityPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') // built-in Storage Blob Data Contributor
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'vairis-app-${environmentName}'
  location: location
  tags: { env: environmentName, project: 'vairis', 'azd-service-name': 'web' } // this tag is how azd knows which resource `web` deploys to
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${userAssignedIdentityId}': {} }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: 3000, customDomains: customDomains }
      registries: [{ server: containerRegistryEndpoint, identity: userAssignedIdentityId }]
      secrets: secretRefs
    }
    template: {
      containers: [
        {
          name: 'web'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest' // placeholder — nothing's been pushed to ACR yet on first provision; azd deploy overwrites this with the real image
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          env: [
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
            { name: 'AZURE_STORAGE_ACCOUNT_NAME', value: storageAccountName }
            { name: 'STORAGE_PROVIDER', value: 'azure' }
            // Container app has only a user-assigned identity (no system-assigned one) —
            // lib/azure-blob.ts's DefaultAzureCredential needs this to pick the right one.
            { name: 'AZURE_CLIENT_ID', value: userAssignedIdentityClientId }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            // schema.prisma's directUrl exists for Supabase's pooler-vs-direct split —
            // Azure Postgres Flexible Server has no such split, so this is just the
            // same connection string again. Without it, `prisma migrate deploy` (now
            // run on every container boot, see Dockerfile) fails schema validation
            // before the app can even start: "Environment variable not found:
            // DIRECT_DATABASE_URL" — took the whole app down, not just migrations.
            { name: 'DIRECT_DATABASE_URL', secretRef: 'database-url' }
            // GOTRUE_INTERNAL_URL is server-only — used by next.config.mjs's rewrite to proxy
            // /auth-api/* to GoTrue from the Next.js server, not the browser. Bare self-hosted
            // GoTrue's CORS layer rejects the `apikey` header supabase-js always sends (it expects
            // Kong in front to have handled that), so the browser can never call GoTrue directly.
            // NEXT_PUBLIC_SUPABASE_URL is therefore a same-origin path, set at build time — no
            // runtime override here, since NEXT_PUBLIC_* values are baked into the client bundle.
            { name: 'GOTRUE_INTERNAL_URL', secretRef: 'supabase-url' }
            { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', secretRef: 'supabase-anon-key' }
            { name: 'SUPABASE_SERVICE_ROLE_KEY', secretRef: 'supabase-service-role-key' }
            { name: 'PAYMENT_GATEWAY', value: 'mock' }
            { name: 'ALLOW_MOCK_PAYMENTS', value: 'true' }
            { name: 'NEXT_PUBLIC_CHECKOUT_ENABLED', value: 'false' }
            { name: 'SHIPPING_PROVIDER', value: 'manual' }
            { name: 'SHIPPING_MOCK', value: 'true' }
            { name: 'ADMIN_EMAILS', secretRef: 'admin-emails' }
            { name: 'GOLD_SYNC_SECRET', secretRef: 'gold-sync-secret' }
            { name: 'ORDER_SWEEP_SECRET', secretRef: 'order-sweep-secret' }
            { name: 'METAL_PRICE_API_KEY', secretRef: 'metal-price-api-key' }
            { name: 'RESEND_API_KEY', secretRef: 'resend-api-key' }
            { name: 'RESEND_FROM_EMAIL', value: 'noreply@thevairis.com' }
            // Quotation pipeline — Discord thread creation + assignee ping (REST side; see
            // Vairis_Customer_Bot for the gateway side and the reminder/escalation poller).
            { name: 'DISCORD_BOT_TOKEN', secretRef: 'discord-bot-token' }
            { name: 'INTERNAL_API_KEY', secretRef: 'internal-api-key' }
            { name: 'DISCORD_QUOTE_CHANNEL_ID', value: '1541151654236389508' }
            { name: 'DISCORD_QUOTE_ASSIGNEE_ID', value: '596759028995063818' }
            { name: 'DISCORD_GUILD_ID', value: '1528950987757195298' }
            { name: 'QUOTE_STALE_QUOTED_HOURS', value: '24' }
          ]
        }
      ]
      scale: {
        minReplicas: isProd ? 1 : 0 // prod avoids cold starts; staging scales to zero between rehearsals
        maxReplicas: isProd ? 3 : 1
      }
    }
  }
  dependsOn: [
    storageBlobAccess
  ]
}

output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
