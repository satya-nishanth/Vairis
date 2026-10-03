-- CreateEnum
CREATE TYPE "CollectionCoverMode" AS ENUM ('CUSTOM', 'COLLAGE');

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN "coverMode" "CollectionCoverMode" NOT NULL DEFAULT 'CUSTOM';
