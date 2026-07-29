param location string
param environmentName string

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'vairis${environmentName}media' // no hyphens allowed, must be globally unique
  location: location
  sku: { name: environmentName == 'prod' ? 'Standard_ZRS' : 'Standard_LRS' } // prod: zone-redundant; staging: cheaper, single-zone
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: true // product images are meant to be publicly readable
  }
  tags: { env: environmentName, project: 'vairis' }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource productMediaContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'product-media'
  properties: {
    publicAccess: 'Blob' // individual blobs readable via URL, container listing stays private
  }
}

output storageAccountName string = storageAccount.name
