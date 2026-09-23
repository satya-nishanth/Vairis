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
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
  if (!accountName) {
    throw new Error('AZURE_STORAGE_ACCOUNT_NAME is not set')
  }
  // Always Buffer in Node — ArrayBuffer from undici File can fail inside uploadData.
  const body = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const container = getBlobServiceClient().getContainerClient(CONTAINER)
  const blockBlob = container.getBlockBlobClient(path)
  await blockBlob.uploadData(body, {
    blobHTTPHeaders: { blobContentType: contentType },
  })
  return blockBlob.url
}

export async function deleteProductMedia(path: string) {
  const container = getBlobServiceClient().getContainerClient(CONTAINER)
  await container.getBlockBlobClient(path).deleteIfExists()
}
