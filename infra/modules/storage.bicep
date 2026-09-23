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
  properties: {
    // Browser PUTs video bytes straight to Blob via user-delegation SAS
    // (admin ImageUploader). Without CORS those cross-origin PUTs fail.
    cors: {
      corsRules: [
        {
          allowedOrigins: [
            'https://vairis-app-staging.niceglacier-18e4c231.centralindia.azurecontainerapps.io'
            'https://www.thevairis.com'
            'https://thevairis.com'
            'http://localhost:3000'
            'http://127.0.0.1:3000'
          ]
          allowedMethods: ['GET', 'PUT', 'HEAD', 'OPTIONS']
          allowedHeaders: ['*']
          exposedHeaders: ['*']
          maxAgeInSeconds: 3600
        }
      ]
    }
  }
}

resource productMediaContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'product-media'
  properties: {
    publicAccess: 'Blob' // individual blobs readable via URL, container listing stays private
  }
}

output storageAccountName string = storageAccount.name
