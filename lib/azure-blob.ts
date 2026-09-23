import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  SASProtocol,
} from '@azure/storage-blob'
import { DefaultAzureCredential } from '@azure/identity'

const CONTAINER = 'product-media'

let blobServiceClient: BlobServiceClient | null = null

function requireAccountName() {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
  if (!accountName) {
    throw new Error('AZURE_STORAGE_ACCOUNT_NAME is not set')
  }
  return accountName
}

function getBlobServiceClient() {
  if (blobServiceClient) return blobServiceClient
  const accountName = requireAccountName()
  blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    // Explicit managedIdentityClientId required: the container app has only a
    // user-assigned identity (no system-assigned one), which DefaultAzureCredential
    // can't disambiguate on its own — it fails the whole chain with
    // CredentialUnavailableError otherwise.
    new DefaultAzureCredential({ managedIdentityClientId: process.env.AZURE_CLIENT_ID }),
  )
  return blobServiceClient
}

export async function uploadProductMedia(path: string, data: Buffer | ArrayBuffer, contentType: string) {
  requireAccountName()
  // Always Buffer in Node — ArrayBuffer from undici File can fail inside uploadData.
  const body = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const container = getBlobServiceClient().getContainerClient(CONTAINER)
  const blockBlob = container.getBlockBlobClient(path)
  await blockBlob.uploadData(body, {
    blobHTTPHeaders: { blobContentType: contentType },
  })
  return blockBlob.url
}

/**
 * Browser → Blob direct upload (videos). Avoids buffering multi‑MB bodies through
 * the Container App (that path was returning empty 500s on ~14MB videos).
 */
export async function createProductMediaUploadTarget(path: string, contentType: string) {
  const accountName = requireAccountName()
  const service = getBlobServiceClient()
  const startsOn = new Date(Date.now() - 5 * 60 * 1000)
  const expiresOn = new Date(Date.now() + 30 * 60 * 1000)
  const userDelegationKey = await service.getUserDelegationKey(startsOn, expiresOn)
  const sas = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER,
      blobName: path,
      permissions: BlobSASPermissions.parse('cw'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    userDelegationKey,
    accountName,
  ).toString()

  const blockBlob = service.getContainerClient(CONTAINER).getBlockBlobClient(path)
  return {
    uploadUrl: `${blockBlob.url}?${sas}`,
    publicUrl: blockBlob.url,
    contentType,
  }
}

export async function deleteProductMedia(path: string) {
  const container = getBlobServiceClient().getContainerClient(CONTAINER)
  await container.getBlockBlobClient(path).deleteIfExists()
}
