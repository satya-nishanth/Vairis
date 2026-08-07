param location string
param environmentName string

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'vnet-vairis-${environmentName}'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] }
    subnets: [
      {
        name: 'snet-container-apps'
        properties: {
          addressPrefix: '10.0.0.0/23' // Container Apps needs a /23 minimum
          delegations: [{ name: 'Microsoft.App/environments', properties: { serviceName: 'Microsoft.App/environments' } }]
        }
      }
      {
        name: 'snet-database'
        properties: {
          addressPrefix: '10.0.2.0/24'
          delegations: [{ name: 'Microsoft.DBforPostgreSQL/flexibleServers', properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' } }]
        }
      }
    ]
  }
  tags: { env: environmentName, project: 'vairis' }
}

output containerAppsSubnetId string = vnet.properties.subnets[0].id
output databaseSubnetId string = vnet.properties.subnets[1].id
output vnetId string = vnet.id
