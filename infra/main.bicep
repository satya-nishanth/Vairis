targetScope = 'subscription'

@minLength(1)
@maxLength(20)
@description('azd environment name (staging or prod) — becomes part of every resource name')
param environmentName string

@minLength(1)
@description('Azure region for all resources')
param location string

@secure()
param postgresAdminPassword string

@secure()
param gotrueJwtSecret string

param siteUrl string

param googleClientId string

@secure()
param googleClientSecret string

param containerRegistryEndpoint string

@secure()
param supabaseAnonKey string

@secure()
param supabaseServiceRoleKey string

@secure()
param adminEmails string

@secure()
param cronSecret string

@secure()
param internalApiKey string

@secure()
param goldApiKey string

@secure()
param resendApiKey string

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

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    principalId: '' // wired to a real identity in Phase 6, once Phase 4's identity module exists
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
    jwtSecret: gotrueJwtSecret
    siteUrl: siteUrl
    apiExternalUrl: 'https://gotrue-vairis-${environmentName}.${containerAppsEnv.outputs.environmentDefaultDomain}'
    googleClientId: googleClientId
    googleClientSecret: googleClientSecret
  }
}

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
      { name: 'supabase-anon-key', value: supabaseAnonKey }
      { name: 'supabase-service-role-key', value: supabaseServiceRoleKey }
      { name: 'admin-emails', value: adminEmails }
      { name: 'cron-secret', value: cronSecret }
      { name: 'internal-api-key', value: internalApiKey }
      { name: 'gold-api-key', value: goldApiKey }
      { name: 'resend-api-key', value: resendApiKey }
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
