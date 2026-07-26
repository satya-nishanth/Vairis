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

output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
