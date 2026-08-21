param location string
param environmentName string

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'vnet-vairis-${environmentName}'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] }
    // No inline `subnets` array here on purpose — see the child resources
    // below. An inline array is authoritative: Azure deletes any subnet not
    // listed on every deploy, which breaks the moment anything (e.g. a
    // jumpbox VM for ad-hoc DB access) gets added to this VNet out-of-band.
    // Subnets as separate child resources only ever manage themselves —
    // unrelated subnets (like a jumpbox someone spun up by hand) are left
    // alone, so deploys and manually-managed debug VMs stop being coupled.
  }
  tags: { env: environmentName, project: 'vairis' }
}

resource containerAppsSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' = {
  parent: vnet
  name: 'snet-container-apps'
  properties: {
    addressPrefix: '10.0.0.0/23' // Container Apps needs a /23 minimum
    delegations: [{ name: 'Microsoft.App/environments', properties: { serviceName: 'Microsoft.App/environments' } }]
  }
}

resource databaseSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' = {
  parent: vnet
  name: 'snet-database'
  properties: {
    addressPrefix: '10.0.2.0/24'
    delegations: [{ name: 'Microsoft.DBforPostgreSQL/flexibleServers', properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' } }]
  }
  dependsOn: [containerAppsSubnet] // Azure rejects concurrent subnet writes under the same VNet — force serial deploys
}

output containerAppsSubnetId string = containerAppsSubnet.id
output databaseSubnetId string = databaseSubnet.id
output vnetId string = vnet.id
