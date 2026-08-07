param location string
param environmentName string
param administratorLogin string
@secure()
param administratorPassword string
param subnetId string = '' // empty until Phase 4 wires VNet integration; public access until then
param vnetId string = '' // required alongside subnetId — Postgres VNet integration needs a Private DNS zone linked to the same VNet

var isProd = environmentName == 'prod'

// Postgres Flexible Server refuses VNet integration without a Private DNS zone
// (EmptyPrivateDnsZoneArmResourceId) — not mentioned in the original migration doc, discovered
// at deploy time. One zone + link per environment, matching the delegated subnet.
resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = if (!empty(subnetId)) {
  name: 'private.postgres.database.azure.com' // exact required name for Postgres Flexible Server VNet integration — not "privatelink...", not servername-prefixed
  location: 'global'
  tags: { env: environmentName, project: 'vairis' }
}

resource privateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = if (!empty(subnetId)) {
  parent: privateDnsZone
  name: 'link-vairis-${environmentName}'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnetId }
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: 'psql-vairis-${environmentName}'
  location: location
  sku: {
    name: 'Standard_B1ms' // Burstable — cheapest production-viable tier, both environments
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: { storageSizeGB: 32 }
    backup: {
      backupRetentionDays: isProd ? 14 : 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' } // both environments — HA is a Phase 6+ upgrade once traffic justifies it
    network: empty(subnetId) ? {
      publicNetworkAccess: 'Enabled'
    } : {
      publicNetworkAccess: 'Disabled'
      delegatedSubnetResourceId: subnetId
      privateDnsZoneArmResourceId: privateDnsZone.id
    }
  }
  tags: { env: environmentName, project: 'vairis' }
  dependsOn: empty(subnetId) ? [] : [privateDnsZoneLink]
}

resource allowAllTemp 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = if (empty(subnetId)) {
  parent: postgres
  name: 'AllowAll-TEMPORARY'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '255.255.255.255' }
}

// PgBouncer is NOT supported on the Burstable tier at all (deploy-time error, discovered
// during this migration — not just "off by default"). Prisma connects directly to Postgres
// instead: correctness-wise this is equivalent to Supabase's Session Pooler (no transaction-mode
// prepared-statement breakage — direct connections don't multiplex, so there's nothing to break),
// it just caps concurrent connections to the tier's max_connections. Fine at current traffic;
// revisit (General Purpose tier + these two configs) if connection-count errors show up.

output postgresHost string = postgres.properties.fullyQualifiedDomainName
