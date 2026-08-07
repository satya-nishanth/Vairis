-- Collections pinned into the storefront nav
ALTER TABLE "Collection" ADD COLUMN "showInNav" BOOLEAN NOT NULL DEFAULT false;
