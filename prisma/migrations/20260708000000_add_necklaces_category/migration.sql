-- AlterEnum (idempotent — init already contains NECKLACES on fresh replays;
-- PENDANTS was missing from init entirely)
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'NECKLACES';
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'PENDANTS';
