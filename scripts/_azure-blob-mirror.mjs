// One-off: mirror Supabase Storage bucket `product-media` into an Azure Blob container.
// Read-only against Supabase — never deletes or modifies the source.
// Usage: node scripts/_azure-blob-mirror.mjs <azure-storage-account-name>
//   Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AZURE_STORAGE_KEY

import { createClient } from "@supabase/supabase-js";
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

const BUCKET = "product-media";
const accountName = process.argv[2];
if (!accountName) {
  console.error("Usage: node scripts/_azure-blob-mirror.mjs <azure-storage-account-name>");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const azureKey = process.env.AZURE_STORAGE_KEY;
if (!supabaseUrl || !supabaseKey || !azureKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / AZURE_STORAGE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const credential = new StorageSharedKeyCredential(accountName, azureKey);
const blobService = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  credential,
);
const container = blobService.getContainerClient(BUCKET);

async function listAllPaths(prefix = "") {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw error;
  const paths = [];
  for (const entry of data) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      // folder — recurse
      paths.push(...(await listAllPaths(path)));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

async function main() {
  const paths = await listAllPaths();
  console.log(`Found ${paths.length} objects in Supabase bucket "${BUCKET}"`);

  let ok = 0;
  let failed = 0;
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error) {
      console.error(`  download failed: ${path} — ${error.message}`);
      failed++;
      continue;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const blockBlob = container.getBlockBlobClient(path);
    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: data.type || "application/octet-stream" },
    });
    ok++;
    if (ok % 25 === 0) console.log(`  ${ok}/${paths.length} mirrored...`);
  }

  console.log(`Done. Mirrored ${ok}, failed ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
