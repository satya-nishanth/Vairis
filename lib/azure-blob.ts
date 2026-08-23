import { BlobServiceClient } from '@azure/storage-blob'
import { DefaultAzureCredential } from '@azure/identity'

const CONTAINER = 'product-media'

let blobServiceClient: BlobServiceClient | null = null

function getBlobServiceClient() {
  if (blobServiceClient) return blobServiceClient
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!
  blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    // Explicit managedIdentityClientId required: the container app has only a
    // user-assigned identity (no system-assigned one), which DefaultAzureCredential
    // can't disambiguate on its own — it fails the whole chain with
    // CredentialUnavailableError otherwise.
    new DefaultAzureCredential({ managedIdentityClientId: process.env.AZURE_CLIENT_ID })
  )
  return blobServiceClient
}

export async function uploadProductMedia(path: string, data: Buffer | ArrayBuffer, contentType: string) {
  const container = getBlobServiceClient().getContainerClient(CONTAINER)
  const blockBlob = container.getBlockBlobClient(path)
  await blockBlob.uploadData(data, { blobHTTPHeaders: { blobContentType: contentType } })
  return blockBlob.url
}

export async function deleteProductMedia(path: string) {
  const container = getBlobServiceClient().getContainerClient(CONTAINER)
  await container.getBlockBlobClient(path).deleteIfExists()
}
