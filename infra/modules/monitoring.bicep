param location string
param environmentName string

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-vairis-${environmentName}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: environmentName == 'prod' ? 90 : 30
  }
  tags: { env: environmentName, project: 'vairis' }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-vairis-${environmentName}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
  tags: { env: environmentName, project: 'vairis' }
}

output logAnalyticsWorkspaceId string = logAnalytics.id
output logAnalyticsCustomerId string = logAnalytics.properties.customerId
@secure()
output logAnalyticsSharedKey string = logAnalytics.listKeys().primarySharedKey
output appInsightsConnectionString string = appInsights.properties.ConnectionString
