param location string
param environmentName string
param subnetId string
param logAnalyticsCustomerId string
@secure()
param logAnalyticsSharedKey string

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-vairis-${environmentName}'
  location: location
  properties: {
    vnetConfiguration: { infrastructureSubnetId: subnetId }
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalyticsSharedKey
      }
    }
  }
  tags: { env: environmentName, project: 'vairis' }
}

output environmentId string = env.id
output environmentDefaultDomain string = env.properties.defaultDomain
