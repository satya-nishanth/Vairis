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

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    principalId: '' // wired to a real identity in Phase 6, once Phase 4's identity module exists
  }
}

output AZURE_RESOURCE_GROUP string = rg.name
output ENVIRONMENT_IS_PROD bool = isProd
output KEY_VAULT_NAME string = keyVault.outputs.keyVaultName
