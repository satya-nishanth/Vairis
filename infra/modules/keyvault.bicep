param location string
param environmentName string
param principalId string // the Container App's managed identity (created Phase 4), granted access here in Phase 6 — empty for now

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-vairis-${environmentName}'
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true // Azure RBAC, not the legacy access-policy model
  }
  tags: { env: environmentName, project: 'vairis' }
}

resource kvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(kv.id, principalId, 'KeyVaultSecretsUser')
  scope: kv
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // built-in Key Vault Secrets User
  }
}

output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
