targetScope = 'subscription'

@minLength(1)
@maxLength(20)
@description('azd environment name (staging or prod) — becomes part of every resource name')
param environmentName string

@minLength(1)
@description('Azure region for all resources')
param location string

// The one secret that has to remain a real deploy-time param: it sets an actual Postgres
// resource property (administratorLoginPassword), not just a container env var, so it can't
// be a Key Vault reference the way the app-level secrets below are.
@secure()
param postgresAdminPassword string

param siteUrl string

param googleClientId string

param containerRegistryEndpoint string

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

module identity 'modules/identity.bicep' = {
  name: 'identity'
  scope: rg
  params: { location: location, environmentName: environmentName }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    principalId: identity.outputs.principalId
  }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
  }
}

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
    logAnalyticsCustomerId: monitoring.outputs.logAnalyticsCustomerId
    logAnalyticsSharedKey: monitoring.outputs.logAnalyticsSharedKey
  }
}

module database 'modules/database.bicep' = {
  name: 'database'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    administratorLogin: 'vairisadmin'
    administratorPassword: postgresAdminPassword
    subnetId: network.outputs.databaseSubnetId // closes public access now that private networking exists
    vnetId: network.outputs.vnetId
  }
}

module gotrue 'modules/gotrue.bicep' = {
  name: 'gotrue'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    containerAppsEnvironmentId: containerAppsEnv.outputs.environmentId
    postgresConnectionString: 'postgres://vairisadmin:${uriComponent(postgresAdminPassword)}@${database.outputs.postgresHost}:5432/postgres' // password is base64 (can contain /+=) — must be percent-encoded or GoTrue's DSN parser breaks at startup (nil-pointer panic in migrate_cmd.go)
    siteUrl: siteUrl
    apiExternalUrl: 'https://gotrue-vairis-${environmentName}.${containerAppsEnv.outputs.environmentDefaultDomain}'
    googleClientId: googleClientId
    keyVaultUri: keyVault.outputs.keyVaultUri
    userAssignedIdentityId: identity.outputs.identityId
  }
}

module acrAccess 'modules/acr-access.bicep' = {
  name: 'acr-access'
  scope: resourceGroup('rg-vairis-shared')
  params: { principalId: identity.outputs.principalId, acrName: 'vairisacr' }
}

module app 'modules/app.bicep' = {
  name: 'app'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    containerAppsEnvironmentId: containerAppsEnv.outputs.environmentId
    containerRegistryEndpoint: containerRegistryEndpoint
    userAssignedIdentityId: identity.outputs.identityId
    userAssignedIdentityPrincipalId: identity.outputs.principalId
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    storageAccountName: storage.outputs.storageAccountName
    secretRefs: [
      { name: 'database-url', value: 'postgresql://vairisadmin:${uriComponent(postgresAdminPassword)}@${database.outputs.postgresHost}:5432/postgres?sslmode=require&schema=public' } // vairisadmin's default search_path is auth-first (for GoTrue) — pin Prisma to public explicitly or its migrations/queries land in the wrong schema
      { name: 'supabase-url', value: gotrue.outputs.gotrueUrl }
      { name: 'supabase-anon-key', keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/supabase-anon-key', identity: identity.outputs.identityId }
      { name: 'supabase-service-role-key', keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/supabase-service-role-key', identity: identity.outputs.identityId }
      { name: 'admin-emails', keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/admin-emails', identity: identity.outputs.identityId }
      { name: 'cron-secret', keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/cron-secret', identity: identity.outputs.identityId }
      { name: 'internal-api-key', keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/internal-api-key', identity: identity.outputs.identityId }
      { name: 'gold-api-key', keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/gold-api-key', identity: identity.outputs.identityId }
      { name: 'resend-api-key', keyVaultUrl: '${keyVault.outputs.keyVaultUri}secrets/resend-api-key', identity: identity.outputs.identityId }
    ]
  }
}

output AZURE_RESOURCE_GROUP string = rg.name
output ENVIRONMENT_IS_PROD bool = isProd
output KEY_VAULT_NAME string = keyVault.outputs.keyVaultName
output APPINSIGHTS_CONNECTION_STRING string = monitoring.outputs.appInsightsConnectionString
output AZURE_STORAGE_ACCOUNT_NAME string = storage.outputs.storageAccountName
output POSTGRES_HOST string = database.outputs.postgresHost
output CONTAINER_APPS_ENVIRONMENT_ID string = containerAppsEnv.outputs.environmentId
output CONTAINER_APPS_ENVIRONMENT_DOMAIN string = containerAppsEnv.outputs.environmentDefaultDomain
output GOTRUE_URL string = gotrue.outputs.gotrueUrl
output APP_URL string = app.outputs.appUrl
