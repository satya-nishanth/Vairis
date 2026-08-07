// One-off: download a specific list of paths from Supabase Storage and
// upload them to an Azure Blob container. Unlike _azure-blob-mirror.mjs
// (which lists the whole bucket — and undercounts on large folders since
// storage.list() silently caps at 1000 per call), this targets exact known
// paths, so no listing/pagination involved.
// Usage: node scripts/_azure-blob-backfill.mjs <azure-storage-account-name> <paths-file>
//   Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AZURE_STORAGE_KEY

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

const BUCKET = "product-media";
const accountName = process.argv[2];
const pathsFile = process.argv[3];
if (!accountName || !pathsFile) {
  console.error("Usage: node scripts/_azure-blob-backfill.mjs <azure-storage-account-name> <paths-file>");
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

const paths = readFileSync(pathsFile, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);

async function main() {
  console.log(`Backfilling ${paths.length} objects into "${accountName}"`);
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
    if (ok % 25 === 0) console.log(`  ${ok}/${paths.length} backfilled...`);
  }
  console.log(`Done. Backfilled ${ok}, failed ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
