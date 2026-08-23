param location string
param environmentName string

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-vairis-app-${environmentName}'
  location: location
  tags: { env: environmentName, project: 'vairis' }
}

output identityId string = identity.id
output principalId string = identity.properties.principalId
output clientId string = identity.properties.clientId
